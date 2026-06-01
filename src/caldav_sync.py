"""CalDAV → local SQLite sync.

The Settings UI lets users save CalDAV credentials, but the original
sync path was removed when calendar storage was migrated to SQLite.
This module re-wires that gap as a one-way pull (remote → local),
called on calendar open and from a periodic scheduler loop.

Design notes:
- We use the `caldav` lib so PROPFIND discovery + REPORT XML work
  across Radicale / Nextcloud / Apple / Fastmail without us
  reinventing the protocol. It's pure Python.
- The lib is synchronous; we run it in a threadpool via
  `asyncio.to_thread` so the FastAPI event loop stays free.
- Each remote calendar maps to one local `CalendarCal` row with
  `source="caldav"` and `id` = a stable hash of the remote URL so
  re-syncs idempotently target the same row.
- Events upsert by VEVENT UID (kept as the local `uid`). Local
  CalDAV-sourced events not seen in the latest pull are deleted so
  remote deletions propagate.
- Datetimes are converted to UTC and the row is flagged `is_utc=True`
  so the serializer adds the Z suffix and the frontend renders in the
  user's local TZ correctly.
"""

import asyncio
import hashlib
import logging
import uuid
from datetime import date, datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# Pull window: 90 days back, 1 year forward. Keeps the REPORT cheap and
# matches what the calendar UI typically renders. Far-future recurring
# events still come through via RRULE expansion on the frontend.
_LOOKBACK_DAYS = 90
_LOOKAHEAD_DAYS = 365


def _stable_cal_id(remote_url: str, account_id: str = "") -> str:
    """Deterministic local id for a remote CalDAV calendar.
    Includes account_id so two accounts pointing at the same server
    get distinct local rows and never overwrite each other."""
    key = f"{account_id}::{remote_url}"
    h = hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]
    return f"caldav-{h}"


def _to_utc_naive(dt):
    """CalDAV datetimes can be tz-aware (with a TZID) or naive. The DB
    column is naive but we set is_utc=True so the serializer adds Z.
    All-day events stay as date and get widened to datetime here."""
    if isinstance(dt, datetime):
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None), False
        return dt, False  # naive → treat as local
    # date-only (all-day)
    return datetime(dt.year, dt.month, dt.day), True


def _sync_blocking(owner: str, url: str, username: str, password: str, account_id: str = "") -> dict:
    """The actual sync — synchronous, intended to run in a threadpool.
    Returns counts: {calendars, events, deleted, errors}."""
    # Lazy imports so a missing `caldav` dep doesn't break app startup —
    # the integrations form still works, sync just no-ops with an error.
    import caldav
    from caldav.lib.error import AuthorizationError, NotFoundError
    from core.database import CalendarCal, CalendarEvent, SessionLocal

    result = {"calendars": 0, "events": 0, "deleted": 0, "errors": []}

    client = caldav.DAVClient(url=url, username=username, password=password)

    # Discovery: try principal → calendars first; if the server doesn't
    # support discovery (or the URL points directly at a calendar), fall
    # back to treating the URL as a single calendar.
    calendars = []
    try:
        principal = client.principal()
        calendars = principal.calendars()
    except (AuthorizationError, NotFoundError) as e:
        result["errors"].append(f"Discovery failed: {e}")
        return result
    except Exception as e:
        logger.info(f"CalDAV principal discovery failed, trying URL as calendar: {e}")
        try:
            calendars = [client.calendar(url=url)]
        except Exception as e2:
            result["errors"].append(f"Could not open URL as calendar: {e2}")
            return result

    if not calendars:
        try:
            calendars = [client.calendar(url=url)]
        except Exception as e:
            result["errors"].append(f"No calendars and URL fallback failed: {e}")
            return result

    start = datetime.utcnow() - timedelta(days=_LOOKBACK_DAYS)
    end = datetime.utcnow() + timedelta(days=_LOOKAHEAD_DAYS)

    db = SessionLocal()
    try:
        for remote_cal in calendars:
            try:
                remote_url = str(remote_cal.url)
                cal_id = _stable_cal_id(remote_url, account_id)
                display_name = (remote_cal.name or "").strip() or "CalDAV"

                local_cal = db.query(CalendarCal).filter(
                    CalendarCal.id == cal_id,
                    CalendarCal.owner == owner,
                ).first()
                if not local_cal:
                    local_cal = CalendarCal(
                        id=cal_id,
                        owner=owner,
                        name=display_name,
                        color="#5b8abf",
                        source="caldav",
                        account_id=account_id or None,
                    )
                    db.add(local_cal)
                    db.commit()
                else:
                    changed = False
                    if local_cal.name != display_name:
                        local_cal.name = display_name
                        changed = True
                    if account_id and local_cal.account_id != account_id:
                        local_cal.account_id = account_id
                        changed = True
                    if changed:
                        db.commit()
                result["calendars"] += 1

                # Fetch events in window. `date_search` returns CalendarObject
                # resources; each may contain one VEVENT (most servers) or
                # several (rare).
                from icalendar import Calendar as iCal

                seen_uids = set()
                # Track events added to the session but not yet committed so
                # duplicate UIDs within the same batch are updated, not re-inserted
                # (which would violate the UNIQUE constraint on commit).
                pending: dict = {}
                try:
                    objs = remote_cal.date_search(start=start, end=end, expand=False)
                except Exception as e:
                    result["errors"].append(f"{display_name}: date_search failed ({e})")
                    continue

                for obj in objs:
                    try:
                        ical = iCal.from_ical(obj.data)
                    except Exception as e:
                        result["errors"].append(f"{display_name}: parse failed ({e})")
                        continue

                    for comp in ical.walk():
                        if comp.name != "VEVENT":
                            continue
                        remote_uid = str(comp.get("uid", "")) or str(uuid.uuid4())
                        uid_val = f"{cal_id}::{remote_uid}"
                        seen_uids.add(uid_val)

                        dtstart_p = comp.get("dtstart")
                        if not dtstart_p:
                            continue
                        start_dt, all_day = _to_utc_naive(dtstart_p.dt)

                        dtend_p = comp.get("dtend")
                        if dtend_p:
                            end_dt, _ = _to_utc_naive(dtend_p.dt)
                        elif all_day:
                            end_dt = start_dt + timedelta(days=1)
                        else:
                            end_dt = start_dt + timedelta(hours=1)

                        # is_utc reflects whether the source carried a TZ
                        # we converted from. All-day = no TZ semantics.
                        row_is_utc = (
                            not all_day
                            and isinstance(dtstart_p.dt, datetime)
                            and dtstart_p.dt.tzinfo is not None
                        )

                        summary = str(comp.get("summary", ""))
                        description = str(comp.get("description", ""))
                        location = str(comp.get("location", ""))
                        rrule = (
                            comp.get("rrule").to_ical().decode()
                            if comp.get("rrule")
                            else ""
                        )

                        existing = pending.get(uid_val) or db.query(CalendarEvent).filter(
                            CalendarEvent.uid == uid_val,
                            CalendarEvent.calendar_id == local_cal.id,
                        ).first()
                        if existing:
                            existing.calendar_id = local_cal.id
                            existing.summary = summary
                            existing.description = description
                            existing.location = location
                            existing.dtstart = start_dt
                            existing.dtend = end_dt
                            existing.all_day = all_day
                            existing.is_utc = row_is_utc
                            existing.rrule = rrule
                        else:
                            new_ev = CalendarEvent(
                                uid=uid_val,
                                calendar_id=local_cal.id,
                                summary=summary,
                                description=description,
                                location=location,
                                dtstart=start_dt,
                                dtend=end_dt,
                                all_day=all_day,
                                is_utc=row_is_utc,
                                rrule=rrule,
                            )
                            db.add(new_ev)
                            pending[uid_val] = new_ev
                        result["events"] += 1
                db.commit()

                # Prune locally-cached CalDAV events that vanished
                # upstream (only within our sync window — events outside
                # the window aren't in `objs`, so we'd false-delete them).
                stale = db.query(CalendarEvent).filter(
                    CalendarEvent.calendar_id == local_cal.id,
                    CalendarEvent.dtstart >= start,
                    CalendarEvent.dtstart <= end,
                    ~CalendarEvent.uid.in_(seen_uids) if seen_uids else CalendarEvent.uid.isnot(None),
                ).all()
                for ev in stale:
                    db.delete(ev)
                result["deleted"] += len(stale)
                db.commit()
            except Exception as e:
                logger.exception("CalDAV sync failed for one calendar")
                result["errors"].append(str(e)[:200])
                db.rollback()
    finally:
        db.close()

    return result


async def sync_caldav(owner: str) -> dict:
    """Pull CalDAV state for all configured accounts for `owner`."""
    from routes.prefs_routes import _load_caldav_accounts

    accounts = _load_caldav_accounts(owner)
    if not accounts:
        return {"calendars": 0, "events": 0, "deleted": 0,
                "errors": ["No CalDAV accounts configured"]}
    totals: dict = {"calendars": 0, "events": 0, "deleted": 0, "errors": []}
    for acc in accounts:
        url = (acc.get("url") or "").strip()
        user = (acc.get("username") or "").strip()
        pw = acc.get("password") or ""
        account_id = acc.get("id") or ""
        if not (url and user and pw):
            totals["errors"].append(
                f"Account '{acc.get('name', account_id)}': missing credentials"
            )
            continue
        try:
            r = await asyncio.to_thread(_sync_blocking, owner, url, user, pw, account_id)
            for k in ("calendars", "events", "deleted"):
                totals[k] += r.get(k, 0)
            totals["errors"].extend(r.get("errors", []))
        except Exception as e:
            logger.exception("CalDAV sync raised for account %s", account_id)
            totals["errors"].append(str(e)[:200])
    return totals


async def sync_caldav_account(owner: str, account_id: str) -> dict:
    """Sync a single CalDAV account by id."""
    from routes.prefs_routes import _load_caldav_accounts

    accounts = _load_caldav_accounts(owner)
    acc = next((a for a in accounts if a.get("id") == account_id), None)
    if not acc:
        return {"calendars": 0, "events": 0, "deleted": 0,
                "errors": [f"Account {account_id!r} not found"]}
    url = (acc.get("url") or "").strip()
    user = (acc.get("username") or "").strip()
    pw = acc.get("password") or ""
    if not (url and user and pw):
        return {"calendars": 0, "events": 0, "deleted": 0, "errors": ["Missing credentials"]}
    try:
        return await asyncio.to_thread(_sync_blocking, owner, url, user, pw, account_id)
    except Exception as e:
        logger.exception("CalDAV sync raised for account %s", account_id)
        return {"calendars": 0, "events": 0, "deleted": 0, "errors": [str(e)[:200]]}
