"""

Copyright::
    +===================================================+
    |                 © 2019 Privex Inc.                |
    |               https://www.privex.io               |
    +===================================================+
    |                                                   |
    |        Postfix Log Parser / Web UI                |
    |                                                   |
    |        Core Developer(s):                         |
    |                                                   |
    |          (+)  Chris (@someguy123) [Privex]        |
    |                                                   |
    +===================================================+

"""
import asyncio
import base64
import hashlib
import json
import logging
import os
import quopri
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Dict

import datefinder
import moment
import rethinkdb.query

from mlp import settings
from mlp.core import get_rethink, __STORE, compile_env_regex, wait_for_rethink
from mlp.objects import PostfixLog, PostfixMessage
from mlp.parser import parse_line

log = logging.getLogger(__name__)

VERSION = "2.0.0"

lockfile = "processing.lock"

# Matches (1) Queue ID and (2) log message
postf_match = r'.*postfix.*\[.+\]\:[ \t](?!statistics|warning)([A-Za-z0-9]{8,15}|NOQUEUE)\:[ \t]+?(.*)'
# Matches (1) Message ID and (2) log message
exim_match = r'([0-9A-Za-z]{6}-[0-9A-Za-z]{6,11}-[0-9A-Za-z]{2,4})\s(.+)'
# Matches (1) Queue ID and (2) log message
sendm_match = r'.*\:\s([0-9A-Za-z]+)\:[ \t]+?(.*)'
# Matches (2) message ID and (1) log message
exch_match = r'([^#]([^,]*,){12}.+)'

settings.mta = settings.mta or 'postfix'
_MATCHERS = {
    'postfix': postf_match,
    'exim': exim_match,
    'sendmail': sendm_match,
    'exchange': exch_match,
}
if settings.mta not in _MATCHERS:
    log.error('Incorrect value of MTA env variable: %s. Check example and set the correct one!', settings.mta)
    raise SystemExit(1)
match = compile_env_regex('PARSER_MATCH_REGEX', _MATCHERS[settings.mta])

VALID_STATUS_CODES = ('sent', 'reject', 'deferred', 'bounced', 'multiple')


class ObjectExists(Exception):
    pass


class OnConflict(Enum):
    QUIET = "quiet"
    EXCEPT = "except"
    UPDATE = "update"


async def save_obj(table, data, primary=None, onconflict: OnConflict = OnConflict.EXCEPT):
    r, conn, _ = await get_rethink()
    _data = dict(data)
    if primary is None:
        return await r.table(table).insert(_data).run(conn, array_limit=settings.rethink_arr_limit)

    if 'id' not in _data:
        _data['id'] = _data[primary]

    if onconflict == OnConflict.UPDATE:
        return await r.table(table).insert(_data, conflict='update').run(conn, array_limit=settings.rethink_arr_limit)

    existing = await r.table(table).get(_data[primary]).run(conn, array_limit=settings.rethink_arr_limit)

    if existing is None:
        return await r.table(table).insert(_data).run(conn, array_limit=settings.rethink_arr_limit)

    if onconflict == OnConflict.QUIET:
        return None
    if onconflict == OnConflict.EXCEPT:
        raise ObjectExists(f"Table '{table}' entry with '{primary} = {_data[primary]}' already exists!")
    raise AttributeError("'save_obj' onconflict must be either 'quiet', 'except', or 'update'")


async def housekeeping(housekeeping_days):
    cutoff = datetime.now(timezone.utc) - timedelta(days=housekeeping_days)
    log.info('Housekeeping will delete all logs before %s', cutoff)

    r, conn, r_q = await get_rethink()
    query = r.table('sent_mail').between(r_q.minval, cutoff, right_bound='closed', index='timestamp').delete()
    result = await query.run(conn, array_limit=settings.rethink_arr_limit)

    deleted = result.get('deleted', 0)
    return {'deleted': deleted, 'status': 'true' if deleted else 'false'}


async def import_log(logfile: str) -> Dict[str, object]:
    log.info('Opening log file %s', logfile)
    messages = {}
    multiple_recipients_qids = []
    multiple_recipients = defaultdict(list)

    counter = 0
    same_qid = ''

    with open(logfile, 'rb') as f:
        while True:
            line = f.readline().decode(errors='replace')
            if not line:
                break

            m = match.search(line) if settings.mta == 'exim' else match.match(line)
            if not m:
                continue

            dtime = None
            for found in datefinder.find_dates(line[:settings.datetime_input_length]):
                dtime = found
                break
            if dtime is None:
                log.debug('Could not extract datetime from log line: %s', line.strip())
                continue

            try:
                dtime = moment.date(dtime, settings.datetime_format).date.replace(tzinfo=timezone.utc)
            except Exception:
                log.debug('Could not parse datetime from log line: %s', line.strip())
                continue

            if settings.mta == 'exchange':
                msg, qid = m.groups()
                qid = qid[:-1]
            else:
                qid, msg = m.groups()

            if settings.mta == 'postfix' and qid == 'NOQUEUE':
                # NOQUEUE lines have no queue id; only rejects carry a complete record
                if not msg.lstrip().lower().startswith('reject:'):
                    continue
                qid = hashlib.md5((str(dtime) + msg).encode('utf-8')).hexdigest().upper()[:11]

            if qid not in messages:
                messages[qid] = PostfixMessage(timestamp=dtime, queue_id=qid)
            messages[qid].merge(await parse_line(msg))

            checking_mailto_alias = {}
            if settings.mta in ('postfix', 'exim'):
                alias_map = messages[qid].get('mail_to_alias')
                if alias_map:
                    try:
                        checking_mailto_alias[qid] = {
                            'mail_to': messages[qid]['mail_to'],
                            'mail_to_alias': alias_map[messages[qid].get('mail_to')],
                        }
                    except KeyError:
                        pass

            checking_mailto = messages[qid]['mail_to']
            if settings.mta == 'exchange':
                messages[qid]['mail_to'] = messages[qid]['mail_to'].replace(',', '')

            if qid == same_qid or same_qid == '':
                if messages[qid]['status'].get('code') is not None and checking_mailto:
                    if checking_mailto in msg or checking_mailto.split('@')[0] in msg:
                        if checking_mailto not in multiple_recipients[same_qid]:
                            same_qid = qid
                            counter += 1
                            if checking_mailto_alias:
                                checking_mailto = checking_mailto_alias[qid]
                            multiple_recipients[same_qid].append(checking_mailto)
            else:
                if counter > 1:
                    multiple_recipients_qids.append(same_qid)
                counter = 0
                same_qid = ''

            messages[qid].lines.append(PostfixLog(timestamp=dtime, queue_id=qid, message=msg))

        if counter > 1:
            multiple_recipients_qids.append(same_qid)

    for qid in list(multiple_recipients):
        if qid not in multiple_recipients_qids:
            del multiple_recipients[qid]

    log.info('Finished parsing log file %s', logfile)
    return {
        'messages': messages,
        'multiple_recipients_qids': multiple_recipients_qids,
        'multiple_recipients': multiple_recipients,
    }


# Matches RFC 2047 encoded words; group 4 is "?=", or the end of a truncated log line
_ENCODED_WORD_RE = re.compile(r'=\?([^?]+)\?([BbQq])\?([^?]*)(\?=|$)', re.IGNORECASE)
_INCOMPLETE_QP_RE = re.compile(r'=[0-9A-Fa-f]?$')
_SEPARATOR_RE = re.compile(r'[\s?]*')


def _decode_bytes(payload: bytes, charset: str, incomplete: bool = False) -> str:
    text = None
    for encoding in (charset, 'utf-8', 'latin-1'):
        try:
            text = payload.decode(encoding, errors='replace')
            break
        except LookupError:
            continue
    if text is None:
        text = payload.decode('utf-8', errors='replace')
    if incomplete:
        text = text.rstrip('\ufffd')
    return text


def _decode_encoded_word(match):
    charset = match.group(1).split('*', 1)[0]
    method = match.group(2).lower()
    text = match.group(3).strip()
    complete = match.group(4) == '?='
    try:
        if method == 'b':
            if len(text) % 4 == 1:
                text = text[:-1]
            text += '=' * (-len(text) % 4)
            return charset, base64.b64decode(text, validate=False), complete
        text = text.replace('_', ' ')
        if not complete:
            text = _INCOMPLETE_QP_RE.sub('', text)
        return charset, quopri.decodestring(text), complete
    except Exception:
        return charset, None, complete


def decode_subject(value):
    """
    Decode RFC 2047 subjects like rspamd: glue adjacent same-charset words before
    decoding, tolerate Postfix's "?=??=?" separators, and salvage truncated words.
    """
    if not isinstance(value, str):
        return value

    value = value.strip()
    if not value:
        return value
    if '=?' not in value:
        return re.sub(r'\s+', ' ', value).strip()

    parts = []
    buffer = bytearray()
    buffer_charset = None
    incomplete = False

    def flush():
        nonlocal buffer_charset, incomplete
        if buffer and buffer_charset is not None:
            parts.append(_decode_bytes(bytes(buffer), buffer_charset, incomplete))
        buffer.clear()
        buffer_charset = None
        incomplete = False

    position = 0
    for match in _ENCODED_WORD_RE.finditer(value):
        plain = value[position:match.start()]
        if plain and not _SEPARATOR_RE.fullmatch(plain):
            flush()
            parts.append(plain)

        charset, payload, complete = _decode_encoded_word(match)
        if payload is None:
            flush()
            parts.append(match.group(0))
        else:
            if buffer_charset is not None and buffer_charset.lower() != charset.lower():
                flush()
            buffer_charset = charset
            buffer.extend(payload)
            incomplete = not complete
        position = match.end()

    tail = value[position:]
    if tail and not _SEPARATOR_RE.fullmatch(tail):
        flush()
        parts.append(tail)
    else:
        flush()

    return re.sub(r'\s+', ' ', ''.join(parts)).strip()


def _status_domain(value) -> str:
    if value and '<>' not in value and '@' in value:
        return value.split('@')[1]
    return ''


def _prepare_message(m):
    status = m.get('status') or {}
    if status:
        if status.get('code') not in VALID_STATUS_CODES:
            if status.get('message'):
                status['message'] = (status.get('code') or '') + status['message']
            else:
                status['message'] = 'no status message found'
            status['code'] = 'unknown'
    else:
        status = {'code': 'unknown', 'message': 'no status message found'}
    m['status'] = status

    try:
        m['subject'] = decode_subject(m.get('subject'))
    except Exception:
        pass

    mfrom = m.get('mail_from') or ''
    mto = m.get('mail_to') or ''
    if _status_domain(mfrom) in settings.ignore_domains or _status_domain(mto) in settings.ignore_domains:
        return None
    return m


async def _import_phase():
    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query

    housekeeping_days = settings.housekeeping_days
    if housekeeping_days and housekeeping_days > 0:
        log.info('Start housekeeping')
        hk_result = await housekeeping(housekeeping_days)
        log.info('Finished housekeeping')
        if hk_result['status'] == 'true':
            log.info('Housekeeping deleted %d messages older than %d day(s)', hk_result['deleted'], housekeeping_days)
        else:
            log.info('Housekeeping deleted nothing. No messages older than %d day(s) or nothing matched.', housekeeping_days)
    else:
        log.info('Housekeeping is not configured, old data will not be deleted!')

    log.info('Importing %s log file', settings.mta)
    import_output = await import_log(settings.mail_log)

    multiple_recipients = import_output['multiple_recipients']
    msgs = import_output['messages']
    msg_list = [{"id": qid, **msg.clean_dict(convert_time=r_q.expr)} for qid, msg in msgs.items()]
    log.info('Total of %d message entries', len(msg_list))

    save_list = []
    for m in msg_list:
        try:
            m = _prepare_message(m)
            if m is None:
                continue
            if m.get('id') in multiple_recipients:
                m['mail_to'] = json.dumps(multiple_recipients[m.get('id')])
                m['status']['code'] = 'multiple'
                m['status']['message'] = 'multiple, see log lines below'
            save_list.append(save_obj('sent_mail', m, primary='id', onconflict=OnConflict.UPDATE))
        except Exception:
            log.exception('Error while preparing email %s', m)

    log.info('Saving %d message entries', len(save_list))
    results = await asyncio.gather(*save_list, return_exceptions=True)
    errors = [result for result in results if isinstance(result, Exception)]
    if errors:
        log.error('%d message(s) failed to save. First error: %s', len(errors), errors[0])
        raise RuntimeError(f'{len(errors)} message(s) failed to save') from errors[0]


async def main():
    if not await wait_for_rethink():
        log.error('RethinkDB did not become ready in time, parser aborted')
        raise RuntimeError('RethinkDB is not ready')

    if settings.gui_refresh_block:
        log.info('Blocking GUI updates while processing')
        open(lockfile, 'w').close()

    try:
        for attempt in range(3):
            try:
                await _import_phase()
                break
            except Exception:
                log.exception('Error while processing log file (attempt %d of 3)', attempt + 1)
                if attempt == 2:
                    raise
                __STORE.clear()
                await asyncio.sleep(5)
    finally:
        if settings.gui_refresh_block:
            log.info('Unblocking GUI updates')
            try:
                os.remove(lockfile)
            except FileNotFoundError:
                pass
    log.info('Finished!')
