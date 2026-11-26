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
import logging
import rethinkdb.query

from typing import Tuple, List

from privex.helpers import empty
from rethinkdb import RethinkDB
from rethinkdb.ast import DB
from rethinkdb.net import DefaultConnection

from mlp import settings
from privex.loghelper import LogHelper

from mlp.settings import AppError, DEFAULT_ERR, ERRORS

_lh = LogHelper('mlp')
_lh.add_console_handler(level=logging.INFO)

log = logging.getLogger(__name__)

__STORE = {}


async def get_rethink() -> Tuple[DB, DefaultConnection, RethinkDB]:
    """

    Usage:

        >>> from mlp.core import get_rethink
        >>>
        >>> r, conn, rDB = await get_rethink()
        >>> r.table('blocks').insert(dict(block_num=1234)).run(conn, array_limit=settings.rethink_arr_limit)


    :return DB rethink: (Tuple Param 1) - Main RethinkDB database query object :class:`rethinkdb.RethinkDB`
    :return DefaultConnection conn: (Tuple Param 2) - Rethink Connection Object :class:`rethinkdb.net.DefaultConnection`
    """
    if 'rethink' in __STORE:
        return __STORE['rethink']

    

    # Setup RethinkDB connection
    r: rethinkdb.query = RethinkDB()
    r.set_loop_type('asyncio')
    conn = await r.connect(settings.rethink_host, settings.rethink_port)
    dbs = await r.db_list().run(conn, array_limit=settings.rethink_arr_limit)
    if settings.rethink_db not in dbs:
        log.debug('Database %s did not exist. Creating.', settings.rethink_db)
        await r.db_create(settings.rethink_db).run(conn, array_limit=settings.rethink_arr_limit)

    # Create required tables inside of database
    db = r.db(settings.rethink_db)   # type: DB
    rtables = await db.table_list().run(conn, array_limit=settings.rethink_arr_limit)
    for t, t2, indexes in settings.rethink_tables:
        if t not in rtables:
            log.debug('Table %s did not exist. Creating.', t)
            await db.table_create(t).run(conn, array_limit=settings.rethink_arr_limit)
        if t2 not in rtables:
            log.debug('Table %s did not exist. Creating.', t2)
            await db.table_create(t2).run(conn, array_limit=settings.rethink_arr_limit)
        idxs = await db.table(t).index_list().run(conn, array_limit=settings.rethink_arr_limit)
        for index in indexes:
            if index not in idxs:
                log.debug('Index %s on table %s did not exist. Creating.', index, t)
                if index == 'status_code':
                    await db.table(t).index_create(index, r.row['status']['code'], multi=True).run(conn, array_limit=settings.rethink_arr_limit)
                else:
                    await db.table(t).index_create(index).run(conn, array_limit=settings.rethink_arr_limit)

    __STORE['rethink'] = db, conn, r
    return __STORE['rethink']


def get_accepts(headers) -> List[str]:
    lower_headers = {k.lower(): v for k, v in headers.items()}
    accepts = lower_headers.get('accept', 'application/json').split(',')
    return [a.split(';')[0] for a in accepts]


def _get_error(code: str, fallback: str = 'UNKNOWN_ERROR') -> AppError:
    """
    Attempt to retrieve an :class:`.AppError` by it's error code, with fallback to the error code ``fallback``.

    If something goes wrong trying to fallback to ``fallback``, then :attr:`.DEFAULT_ERR` will be returned instead.

        >>> err = _get_error('NOT_FOUND')
        >>> print(err.code, err.message)
        NOT_FOUND The requested resource or URL was not found. You may wish to check the URL for typos.

        >>> err = _get_error('NON_EXISTENT_ERR')
        >>> print(err.code, err.message)
        UNKNOWN_ERROR An unknown error has occurred. Please contact the administrator of this site.

    :param str code:      The error code to attempt to retrieve, e.g. ``NOT_FOUND``.
    :param str fallback:  The error code to attempt to fallback to, if ``code`` wasn't found.
    :return AppError err: An instance of an error in :class:`.AppError` form.
    """
    e = ERRORS.get(code, ERRORS.get(fallback))
    if empty(e, True, True): return DEFAULT_ERR
    return e


def add_app_error(code: str, msg: str, status: int = 500) -> AppError:
    """
    Add a new error code for easy API error raising.

        >>> add_app_error("INV_TOKEN", "Invalid API token specified in Authorization header.", 403)


    :param str code:     A short, unique capitalized error code, e.g. ``INV_USERNAME`` - this code should be static, i.e. never change,
                         since it should be used by API clients for handling certain errors.
    :param str msg:      A human readable error message, e.g. "Username must be at least 5 characters"
    :param int status:   An integer HTTP status code that should be returned when this error is raised.
    :return AppError err:  The :class:`.AppError` instance which was added/updated in :attr:`.ERRORS`
    """
    ERRORS[code] = AppError(code, msg, status)
    return ERRORS[code]

