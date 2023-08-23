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
import json
from dataclasses import dataclass, field
from typing import List, Union, Mapping, Tuple

import rethinkdb.query
import logging

from rethinkdb.net import DefaultConnection
from mlp.main import VERSION
from mlp import settings, api


from mlp.exceptions import APIException
from mlp.core import get_rethink
from quart import Quart, session, redirect, render_template, request, flash, jsonify
from privex.helpers import random_str, empty, filter_form, DictDataClass, DictObject
# for timestamp process
from datetime import datetime, timedelta, timezone

from dateutil import parser
# TODO dayjs? as moment is deprecated
import moment

log = logging.getLogger(__name__)

app = Quart(__name__)

# add path prefix
PREFIX = settings.path_prefix
new_static_path = PREFIX+"/static"
app.static_url_path = new_static_path

'''for rule in app.url_map.iter_rules('static'):
    app.url_map._rules.remove(rule)  # There is probably only one.'''

app.url_map._rules_by_endpoint['static'] = []

app.add_url_rule(f'{new_static_path}/<path:filename>',
                 endpoint='static',
                 view_func=app.send_static_file)

app.secret_key = settings.secret_key

Table = rethinkdb.query.ast.Table
RqlQuery = rethinkdb.query.ast.RqlQuery
QueryOrTable = Union[Table, RqlQuery]

@app.route(f'{PREFIX}/', methods=['GET'])
async def index():
    print(settings.mail_domain)
    NOTIE_MESSAGE = await _process_notie()

    if 'admin' in session:
        return redirect(f'{PREFIX}/emails/')
    
    return await render_template('login.html', settings=settings, NOTIE_MESSAGE=NOTIE_MESSAGE, VERSION=VERSION)



@app.route(f'{PREFIX}/login', methods=['POST'])
async def login():
    frm = await request.form
    if frm.get('password') == settings.admin_pass:
        session['admin'] = random_str()
        
        return redirect(f'{PREFIX}/emails/')

    session['NOTIE_MESSAGE'] = "pass_error"

    return redirect(f'{PREFIX}/')


@app.route(f'{PREFIX}/emails', methods=['GET'])
@app.route(f'{PREFIX}/emails/', methods=['GET'])
async def emails_ui():

    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')
    return await render_template('emails.html', VUE_DEBUG=settings.vue_debug, settings=settings, VERSION=VERSION)


@app.route(f'{PREFIX}/logout', methods=['GET'])
async def logout():
    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    del session['admin']
    session['NOTIE_MESSAGE'] = "logged_out"
    return redirect(f'{PREFIX}/')


@dataclass
class PageResult(DictDataClass):
    result: Union[list, dict, str, int, float] = field(default_factory=list)
    error: bool = False
    error_code: str = None
    count: int = 0
    remaining: int = 0
    page: int = 1
    total_pages: int = 1
    message: List[str] = field(default_factory=list)
    messages: List[str] = field(default_factory=list)
    
    raw_data: Union[dict, DictObject] = field(default_factory=DictObject, repr=False)
    # ^ The raw, unmodified data that was passed as kwargs, as a dictionary
    
    def to_json_dict(self) -> dict:
        d = dict(self)
        
        if not d['error']:
            if 'error_code' in d and empty(d['error_code'], True, True):
                del d['error_code']
            if 'messages' in d and empty(d['messages'], True, True):
                del d['messages']
            if 'message' in d and empty(d['message'], True, True):
                del d['message']
        
        return d
    
    def to_json(self, indent=4, **kwargs) -> str:
        return json.dumps(self.to_json_dict(), indent=indent, **kwargs)


@app.route(f'{PREFIX}/api/emails', methods=['GET'])
async def api_emails():
    """

    All GET params are used for filtering. Use ``x.y`` to access sub-dict key's (only works for 1 layer deep),
    and append ``__lt`` / ``__gt`` to the end of a key for ``<=`` and ``>=`` respectively.


    Example queries:

        Get emails where ``mail['status']['code'] == 'bounced'``

        /api/emails?status.code=bounced


        Get emails older than or equal to ``2019-09-17 00:00:00`` but newer than 2019-09-10 00:00:00

        /api/emails?timestamp__lt=2019-09-17 00:00:00&timestamp__gt=2019-09-10 00:00:00


        Find a specific email by ID

        /api/emails?id=E553EBD87B


    :return:
    """
    if 'admin' not in session:
        session['NOTIE_MESSAGE'] = "unauth"
        return redirect(f'{PREFIX}/')

    r, conn, r_q = await get_rethink()
    r_q: rethinkdb.query

    frm = dict(request.args)
    order_by = str(frm.pop('order', 'last_attempt')).lower()
    order_dir = str(frm.pop('order_dir', 'desc')).lower()
    #print(request)
    

    _sm = r.table('sent_mail')
    
    # check mail_to in log lines
    if 'mail_to' in frm:
        search_string = str(frm.pop('mail_to'))#.lower()
        recipient_match = ''
        if settings.mta == 'exim':
            recipient_match = "\*\* |-> |=> |== |>> "
            #recipient_match = "-> |=> |== |>> "
            #recipient_match = "->|=>|==|>> "
        if settings.mta == 'sendmail' or settings.mta == 'postfix':
            recipient_match = "^to="

        # TODO testing add rethink_arr_limit to all queries
        found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: m['message'].match(search_string)).filter(lambda m: m['message'].match(recipient_match)).run(conn, array_limit=settings.rethink_arr_limit)
        
        ids = []
        async for f in found_strings:
            ids.append(f['queue_id'])
        #_sm = _sm.filter(lambda doc: r_q.expr(ids).contains(doc['queue_id']))
        # new much more effective query method
        _sm = _sm.get_all(r_q.args(ids), index='id').distinct()

        

    # check log lines
    if 'log_lines' in frm:
        search_string = str(frm.pop('log_lines'))#.lower()
        found_strings = await _sm.concat_map(lambda m: m['lines']).filter(lambda m: m['message'].match(search_string)).run(conn, array_limit=settings.rethink_arr_limit)
        ids = []
        async for f in found_strings:
            ids.append(f['queue_id'])
        #_sm = _sm.filter(lambda doc: r_q.expr(ids).contains(doc['queue_id']))
        # new much more effective query method
        _sm = _sm.get_all(r_q.args(ids), index='id').distinct()
        
    # Handle appending .filter() to `_sm` for each filter key in `frm`
    _sm = await _process_filters(query=_sm, frm=frm)

    _sm, res = await _paginate_query(_sm, frm, rt_conn=conn, rt_query=r_q, order_by=order_by, order_dir=order_dir)
    _sm = await _sm.run(conn, array_limit=settings.rethink_arr_limit)

    #print(list(_sm))

    sm = []
    if type(_sm) is list:
        sm = list(_sm)
    else:
        async for s in _sm:
            sm.append(dict(s))
    
    res.result = sm

    return jsonify(res.to_json_dict())


async def _paginate_query(query: QueryOrTable, frm: Mapping, rt_conn: DefaultConnection, rt_query: rethinkdb.query,
                          order_by=None, order_dir='desc') -> Tuple[QueryOrTable, PageResult]:
    _lo = filter_form(frm, 'limit', 'offset', 'page', cast=int)
    limit, offset, page = _lo.get('limit', settings.default_limit), _lo.get('offset', 0), _lo.get('page')

    if not empty(page, True, True):
        offset = limit * (page - 1)
    offset = 0 if offset < 0 else offset
    res = PageResult(error=False, count=0, remaining=0, page=1 if not page else page, total_pages=1)
    # Get the total number of rows which match the requested filters
    count = await query.count().run(rt_conn, array_limit=settings.rethink_arr_limit)
    #print ("Total number of rows found: ",count)

    # rt_query: RqlTopLevelQuery
    r_order = order_by if order_dir == 'asc' else rt_query.desc(order_by)
    limit = settings.default_limit if limit <= 0 else (settings.max_limit if limit > settings.max_limit else limit)
    offset = (count - limit if (count - limit) > 0 else 0) if offset >= count else offset
    page = int(offset / limit) + 1
    # fix of pagination wrong total_pages calc
    if (count % limit) == 0:
        total_pages = int(count / limit)
    else:
        total_pages = int(count / limit) + 1
    total_pages = 1 if total_pages < 1 else total_pages
    page = 1 if page < 1 else page
    res.count, res.remaining, res.page, res.total_pages = count, count - offset, page, total_pages

    query = query.order_by(r_order).skip(offset).limit(limit)
    return query, res


async def _process_filters(query: QueryOrTable, frm: Mapping, skip_keys: List[str] = None) -> QueryOrTable:
    if empty(frm, itr=True):
        return query
    
    skip_keys = ['limit', 'offset', 'page'] if not skip_keys else skip_keys
    
    for fkey, fval in frm.items():
        if fkey in skip_keys:
            continue
        query = await _filter_form_key(fkey=fkey, fval=fval, query=query)
    #print("query: ",query)
    return query


async def _filter_form_key(fkey: str, fval: str, query: QueryOrTable) -> QueryOrTable:
    if '.' in fkey:
        k1, k2 = fkey.split('.')
        return query.filter(lambda m: m[k1][k2] == fval)
    if '__lt' in fkey:
        fkey = fkey.replace('__lt', '')
        fval = moment.date(fval,settings.datetime_format).date
        fval = fval.replace(tzinfo=timezone.utc)
        return query.filter(lambda m: m[fkey] <= fval)
    if '__gt' in fkey:
        fkey = fkey.replace('__gt', '')
        fval = moment.date(fval,settings.datetime_format).date
        fval = fval.replace(tzinfo=timezone.utc)
        return query.filter(lambda m: m[fkey] >= fval)
    # full wildcard to key value (i.e. *find string*)
    rval = fval.replace('*', '')  # fval but without asterisks
    query = query.filter(lambda m: m[fkey].match(rval))
    return query

    return query.filter(lambda m: m[fkey] == fval)

async def _process_notie():
    NOTIE_MESSAGE = ""
    if 'NOTIE_MESSAGE' in session:
        NOTIE_MESSAGE = session['NOTIE_MESSAGE']
        del session['NOTIE_MESSAGE']
    return NOTIE_MESSAGE

@app.errorhandler(404)
async def handle_404(exc=None):
    return await api.handle_error('NOT_FOUND', VERSION=VERSION, exc=exc)


@app.errorhandler(APIException)
async def api_exception_handler(exc: APIException, *args, **kwargs):
    #print(exc.template)
    return await api.handle_error(err_code=exc.error_code, VERSION=VERSION, err_msg=exc.message, code=exc.status, exc=exc, template=exc.template)


@app.errorhandler(Exception)
async def app_error_handler(exc=None, *args, **kwargs):
    log.warning("app_error_handler exception type / msg: %s / %s", type(exc), str(exc))
    log.warning("app_error_handler *args: %s", args)
    log.warning("app_error_handler **kwargs: %s", kwargs)
    return await api.handle_error('UNKNOWN_ERROR', VERSION=VERSION, exc=exc)
