Unreleased VER.
- replace momentjs wih day.js or luxone(?)
- make mailcow PR to integrate into
- remove python privex helpers code (?)
- save settings into cookies (for firefox private window mainly) + accept cookies modal (?)
- fix dropdown update if use fomantic ui div based dropdown
- upgrade procedure from GUI (?) if decided to do so use [this manual](https://stackoverflow.com/questions/32163955/how-to-run-shell-script-on-host-from-docker-container/63719458#63719458)
- minify
- add multiple simultanious text filters (with and/or concatenator)
- MS Exchange multiple mail_to processing
- [fix of non-dockerizeed deploy issue](https://github.com/drlight17/mta-log-parser/issues/10)
- provide variables in .env for user defined parser regexps override
- don't update rows in table while parsing is running (cause multiple recipients with wrong status) - block page update while parsing is running?  
- BUG: email details modal -> subject - sometimes colored as status:  
    `Invitation to Submit Abstract for 20-Minute Oral Presentation`

VER. 1.8.1
- ~~BUG: exim multiple mail_to parsing fix~~
- ~~add number of days to overall stats title (from housekeeping var)~~
- ~~BUG: version check comparision fix~~
- ~~copyright year add~~
- ~~add static versioning~~

VER. 1.8
- ~~[SECURITY: werkzeug debugger vulnerable](https://github.com/drlight17/mta-log-parser/security/dependabot/3)~~  
- ~~parse exim mail_to in milter reject case (rspamd for example), add prepare info to README~~
- ~~aliases parsing for exim in multiple recipients emails~~
- ~~BUG: stats for log_lines filter apply fix~~
- ~~parse relay and client port in exim~~
- ~~[BUG: postfix rejected lines with NOQUEUE become one db record with multiple status](https://github.com/drlight17/mta-log-parser/issues/13)~~
- ~~BUG: exim parser for log_selector= +all~~
- ~~replace CDN js libraries to local~~
- ~~styling of long subject column~~
- ~~auto scroll to the top on email details modal when swipe left/right~~

VER. 1.7.1
- ~~BUG: Unhandled error during execution of scheduler flush. This is likely a Vue internals bug~~
- ~~BUG: exit button overflow in mobile view~~
- ~~multiple mailto added index number~~
- ~~BUG: not all recipients appear in mail_to column if big newsletter (exim example qid 1rnZID-00DxLS-G1) --- main.py:257 ??~~
- ~~improve GUI for many recipients - scroll with max-height~~
- ~~remove TLS from non TLS text~~

VER. 1.7
- ~~click arrows for modal view to get first and last message correspondly~~
- ~~BUG: loading on top sometimes~~
- ~~home and end key bindings for modal view to get first and last message respectively~~
- ~~sort icon to the same shevrons as main menu gui show/hide buttons~~
- ~~BUG: vertical scroll of modals by arrow keys~~
- ~~TLS + status in the email details~~
- ~~bigger bars and fonts for top charts~~
- ~~main menu buttons border~~
- ~~turn off blur by default for mobile devices (use is_mobile var)~~
- ~~move settings and tips to modal menus~~
- ~~change "Hide" to cross (times icon), cross (times icon) to eye icon, add Hide title, change clear exclude slash eye icon to trash alternate icon (or group two icons like [this](https://fomantic-ui.com/elements/icon.html#icons))~~
- ~~multiple mail_to save as array~~
- ~~remake multiple filtered stats~~
- ~~remake multiple filtered emails and details view (TEST in different MTA!!!)~~
- ~~remake addFilterLink for multiple (TEST in different MTA!!!)~~
- ~~BUG: unknown with all recipients in exchange top 10 recipients stats~~
- ~~BUG: trim comma in exchange recipients~~
- ~~BUG: swipes pass 6 email instead of 1~~
- ~~BUG: context menu is on the left (Macbook)~~
- ~~BUG: multiple with no aliases link on the parent TD~~
- ~~optimize and fix mail_to querie with and without not(!)~~
- ~~show stats context menu with no data~~
- ~~BUG: use stats context menu in mobile view~~
- ~~make stats bars more thick in mobile view~~
- ~~add tips about stats context menu (long press and right click)~~
- ~~BUG: vertical scroll mobile view jump to top (modal details)~~
- ~~BUG: change multiple li to span to fix overflow and hover effects~~
- ~~add postfix orig_to (alias) to multiple mail_to li list (in brackets after to)~~
- ~~BUG: email list and detail alias appearance (details look awful)~~
- ~~BUG: fix stats top mail_to_alias appearance~~
- ~~stats context menu max height with scroll for many hiddens + place context menu to the left from cursor~~
- ~~mobile multiple view aliases in one row (hover effect must be fixed)~~
- ~~BUG: emails list multiple overflow view~~
- ~~BUG: prevent vertical scrolling when swiping left and right (modal details)~~
- ~~BUG: prevent swipe when swiping log_lines in (modal details)~~
- ~~BUG: fix postfix mail_to multiple regex (with orig_to)~~
- ~~hidden addresses stats indicator~~
- ~~show slow log_lines queries attention after choosing this filter (notie)~~
- ~~BUG: emails list width is wider then other gui blocks with editable column width turned on~~  
- ~~BUG: fix stat cached over hover details~~

VER. 1.6
- ~~use more then one CPU core when parsing (moment timestamp convert of related logs is variable)~~
- ~~add ability to exclude some addresses from the TOP charts (frontend gui cookies + backend permanent using settings)~~
- ~~add stats cached text background for better readability~~
- ~~show all currently excluded in gui (backend in tips, frontend in gui)~~
- ~~BUG: currently excluded unknown list fix~~
- ~~BUG: fix currently excluded context menu (right click) doesn't appear in mobile view~~
- ~~clear all currently excluded from cookies button~~
- ~~BUG: exclude unknown~~
- ~~add not (!) to text filters~~
- ~~BUG: fix not(!) appearance in mobile mode~~
- ~~BUGs with all stats after not(!) were added~~
- ~~process sharelink, save and restore not (!) parameter value and from link~~
- ~~BUG: stats_app is not defined~~
- ~~fix "invalid data" in cached stats after cookie clear (replace with error text or copy last date to browser localstorage to use it in this case)~~
- ~~[security fix](https://github.com/drlight17/mta-log-parser/security/dependabot/1)~~
- ~~closed graphs and settings/tips by default~~

VER. 1.5.5
- ~~BUG: auto turn on "save filters" on every link come even without paramaters~~
- ~~BUG: not active pages buttons~~
- ~~localize statuses in table~~
- ~~localize statuses in stats~~
- ~~BUG: invalid date in watermarks in some conditions (clear_cookies wrong usage, try drop new logs to docker)~~
- ~~optimize cleanup rethinkdb query with between~~

VER. 1.5.4
- ~~save incoming URL if not authorized to get to this URL after authorization~~
- ~~widths of footer and main wrapper are now 100%~~
- ~~fix of filter buttons in responsive mode~~
- ~~LDAP version override function (for errors like "Operation unavailable without authentication")~~

VER. 1.5.3
- ~~share link~~  
- ~~fix order by share_link (call get_URL_params in proper place)~~
- ~~dont fetch all statuses in filtered_pie if status is in the filter + get all statuses from emails response to form filtered_pie~~
- ~~fix api error loading hide~~
- ~~fix invalid date in lt~~

VER. 1.5.2
- ~~remove arrow key binding after modal close~~
- ~~filter on stats click~~
- ~~auto refresh must change timestamp_lt~~
- ~~fix maximum call stack size exceeded when draw_donut is called~~

VER. 1.5.1
- ~~exim mail_from parser improvement~~
- ~~quart + werkzeug versions pip fix~~
- ~~filter notie message doubling fix~~

VER. 1.5
- ~~BUG: exim regexp for qid sometimes no mail_from match!~~
- ~~use between instead of filter in emails api~~
- ~~add buttons to manually refresh stats~~
- ~~add timestamps of stats cookies to charts (watermark)~~
- ~~exported name with date~~
- ~~stats refresh animation~~
- ~~notie warning about not filled dates with stay (when filters set to true)~~
- ~~cache all charts until filters change (compare localStorage filters values with current vue vars values)~~
- ~~apply current date filter to top_senders and top_recipients (between hack)~~
- ~~force clear cookie before show filtered stats~~
- ~~deal with stats visibility and run draw charts~~
- ~~fix of fetch errors in main_app.js~~
- ~~reconnection to rethinkdb if disconnected in case of multiple refreshes with heavy queries~~

VER. 1.4
- ~~summaries and graphs for period and overall:~~
- ~~rethinkdb query for overall_pie (statuses %)~~
- ~~rethinkdb query for filtered_pie (statuses %)~~
- ~~rethinkdb query for filtered_throughoutput (top senders, top recipients)~~
- ~~fix of refresh positioning of view (because of hidable GUI blocks)~~
- ~~fix of wrong titles for multiple recipients filter links~~
- ~~no data for bar charts~~
- ~~force local storage, session and cookies clear after upgrade~~
- ~~search button for text filter instead of watcher~~
- ~~export to xlsx file (table) (?)~~
- ~~ldap auth~~
- ~~add selfsigned ca cert append in Dockerfile for TLS connections i.e. LDAPS~~
- ~~BUG: dont run emails query on the auth page~~

VER. 1.3.1 
- ~~add new universal datetime extractor (datefinder) for parser~~

VER. 1.3 
- ~~mobile swipes in message details~~
- ~~small css modal arrows fix~~
- ~~BUG: swipes stays after modal closed~~
- ~~multi-user access: create/edit/delete accounts gui, first-time access registration gui~~
- ~~BUG: no notie notification if created from auth menu~~
- ~~use another page edit and delete form instead of modal - troubles with multiple forms and submits~~
- ~~BUG: almost empty this.settings on auth page => no dark theme, modal prefs and so on~~
- ~~force logout if current logged in user account were deleted~~

VER. 1.2.1
- ~~improve modal arrows height sticky~~

VER. 1.2
- ~~multiple recipients localization ~~
- ~~modal arrows to open next and previous message details~~
- ~~bind arrow keys for modal left and right arrows~~
- ~~initial MS Exchange server csv log file support~~
- ~~BUG: cloning of #update_available while refreshed~~   
- ~~BUG: no #update_available if nothing found (with refresh)~~

VER. 1.1.7.5 
- ~~log_lines timestamp format must match current GUI timestamp format~~ 
- ~~update available message in footer~~
- ~~rethinkdb array_limit set in .env~~

- VER. 1.1.7.4
- ~~BUG: error while search mail_to in last version with exim~~ 
- ~~open/hide button for tips and user settings~~
- ~~refresh rotation animation only in the moment of refresh~~

VER. 1.1.7.3
- ~~BUG: postfix queue ID length may not be equal to 10 symbols~~
- ~~BUG: exim wrong parsing mail_to for some bounces ~~
- ~~add DLR developed logo in footer~~

VER. 1.1.7.2
- ~~BUG: log_lines filter outputs the same id emails (only exim?)~~
- ~~BUG: dark mode filling text search with black font color instead of white~~
- ~~add TLS encrypted connection icon to message status (maybe TLS info on icon hover?)~~

VER. 1.1.7.1
- ~~fix #filter-email coloring in all modes and with resetfilters button~~
- ~~loading circle after full page reload in dark mode~~
- ~~wrong row coloring if there are status keywords in table tds~~
- ~~fix link line color in dark mode~~ 

VER. 1.1.7
- ~~"before refresh" timer in GUI~~
- ~~dont show loading circle when autorefresh~~ 
- ~~force add domain from URL to the titles, if nothing else is filled in .env file~~
- ~~docker update procedure description in README~~

VER. 1.1.6.1
- ~~default_period GUI minutes after 60 to hours and after 1440 to days~~
- ~~some gui and tips polish~~
- ~~dirty waits (like in setDark() for 1000 ms) replace with waitForElm or remove waits~~
- ~~build docker image and place it to docker hub~~

VER. 1.1.5
- ~~dark theme mode (use inverted class for ui elements)~~
- ~~optimize table colored_rows for dark mode~~
- ~~default dark mode from the browser~~  
- ~~api error darkmode~~
- ~~save dark mode at login screen~~
- ~~dark css for hide table header button in mobile view~~
- ~~toggleLoading show on locale change~~
- ~~optimization of log_lines and mail_to query filters so threr is no need for the forced 24 hours time period~~

VER. 1.1.4
- ~~gui autorefresh 0 value as "no autorefresh"~~
- ~~to fix log_lines filter 1 min timeout (504 error) by forced apply time period (in frontend)~~
- ~~to fix mail_to filter in postfix~~
- ~~padding to the cells in table resizable mode~~

VER. 1.1.3
- ~~tail realtime parsing mode + gui autorefresh (with config seconds)~~
- ~~fix refresh undefined time on login page~~
- ~~add mail_domain variable to env for the site title (or fetch from the current URL)~~
- ~~replace input type numbers to range to prevent wrong values~~
- ~~no table found exception process~~
- ~~check that nothing found function added~~
- ~~update log file in docker if rotated~~
- ~~css hover cell link effect~~
- ~~nginx rewrite static remove~~

VER. 1.1.2
- ~~exclude-marquee remove~~   
- ~~fix broken colResizable~~   
- ~~save filters turn off must apply current last minutes!~~   
- ~~loading circle during api call and request waiting~~  
- ~~fix focus to password input on login load~~   
- ~~fix of emails page if localStorage is empty (force reload page on error like "Cannot read properties of undefined (reading 'log_out')")~~
- ~~fix wrong text search filter if reload button is clicked~~  
- ~~fix of notie z-index in firefox (under loading modal)~~ 
- ~~fix not parsed statuses (unknown status?) for postfix~~
- ~~on row click instead of show button~~
- ~~make new refresh button~~
- ~~fix settings show when reload with no locale loaded~~

VER. 1.1.0
- ~~parser cuts the 1st symbol in queue ID (E6E6462414 instead of EE6E6462414 for example)~~
- ~~add message subject to the parser and GUI~~
- ~~add message size to the parser and GUI~~
- ~~log rotation configuration~~
- ~~calendar js date picker for Older than and Newer than~~
- ~~add sticky-headers~~
- ~~add more statuses to parser and GUI (reject, milter-reject)~~
- ~~add last page, first page buttons to GUI~~
- ~~add sort columns~~
- ~~make docker container~~
- ~~add saving of current filter for page reload (use local storage as user settings)~~
- ~~add up button~~
- ~~button to turn on/off blur modal effect~~
- ~~create logo and favicon~~
- ~~sort css~~
- ~~add icons for statuses~~
- ~~add status styling gui tumbler~~
- ~~remove marquee in mobile mode~~
- ~~loading modal instead of div above table~~
- ~~add other popular MTA support (parser.py + settings.py + .env)~~
- ~~EXIM: multiple recipients + multiple statuses + multiple relays parsing, processing and output~~
- ~~add log lines search filter (for multiple recipients)~~
- ~~SENDMAIL:~~
- ~~add * to search filters on backend~~
- ~~fix pagination calculation~~
- ~~refactor sticky related stuff~~
- ~~fix parse of relay and client if without ip address "\[x.x.x.x\]"~~
- ~~add gui table columns resize switcher~~
- ~~port from vue2 to vue3, fix next bugs~~
- ~~pager doesn't work~~
- ~~reset button doesn't work~~
- ~~no logo shown~~
- ~~add locale support: + env var for datetime format (to sync datepicker format with webui.py)~~
- ~~addFilterLink() locale support~~
- ~~fetch supported locales based on /static/locales folder using python flask and send them to template~~
- ~~Current browser locale not supported message to notie (row 194)~~
- ~~fix modal close button position in wide width window~~
- ~~500 ms delay for loading circle~~
- ~~api_error locale handling~~
- ~~get from browser~~
- ~~calendar localization based on locale~~
- ~~fallback locale if browser locale is not in supported locales~~
- ~~replace "postfixparser" folder and code with "mlp"~~
- ~~rename to mta log parser~~
- ~~errors if js modules didn't load~~
- ~~no results message if no rows returned~~
- ~~fix broken colResizable~~
- ~~fix calendar not working~~
- ~~focus to password input on login page~~
- ~~login page~~
- ~~notie~~
- ~~backend login messages replace with notie~~
- ~~fix right click to reset column widths~~
- ~~save lang JSON into localStorage for cache (faster page reloads)~~
- ~~make placeholders or hide all page content while loading~~ ~~and default language fallback if no localization for element found~~
- ~~fix no messages on login page (errors, warns, info)~~
- ~~format datetime inputs with datetimeformat from .env~~
- ~~fix narrow columns widths (status, dates, IDs) to some percentages with resizable columns off~~
- ~~filter autofill on click at cells according to its type (timestamp fills date, queue id fills text queue id etc.)~~
- ~~sticky header gui switcher~~
- ~~cleanup from tablesorter~~

VER. 1.0.0
- ~~page goes to top when refresh without colResize~~
- ~~save sticky header state in localStorage~~
- ~~fix append icons to statuses on refresh button with tablesort off~~
- ~~sort by all found rows instead of current page only~~
- ~~permanent refresh in mobile mode when text inputs are in focus~~
- ~~add show/hide thead in mobile mode~~
- ~~add gui option show logs from last N minutes~~ \+ env default_value for this
- ~~styling table in modal (+ marquee)~~ 
- ~~forbid special symbols (?, / and so on) in text search input~~  
- ~~remaining window height if strong filter is applied (also this happen when maximum results per page is small) - recalc windows height on loadEmails()~~
- ~~fix page goes to top when loadEmails() is called~~ 
- ~~firefox dont support css resize on th and tables (maybe try https://mottie.github.io/tablesorter/docs/example-widget-resizable.html)~~    
- ~~fix loading goes to the top and wrong modal conversion after show details clicks and call any loadEmails()~~  
- ~~firefox overflow hidden css fix (it has no support for :has selector since 103)~~
- ~~reset date filters and all filters buttons~~
