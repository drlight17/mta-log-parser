// append path_prefix to the base_url if any is set
const base_url = document.currentScript.getAttribute('path_prefix')+'/api/emails';
// get datetime_format from .env
const datetime_format = document.currentScript.getAttribute('datetime_format');
// get HOUSEKEEPING_DAYS from .env
const housekeeping_days = document.currentScript.getAttribute('housekeeping_days');

window.addEventListener('load', () => {
    window.debounce_emails = _.debounce(function () {
        app.loadEmails();
    }, 400); // default was 1000
    window.app = new Vue({
        el: '#app',
        data: {
            loading: true,
            error: null,
            emails: [],
            search: "",
            search_by: "id",
            status_filter: "NOFILTER",
            date_filter__gt: "",
            date_filter__lt: "",
            page: 1,
            page_count: 1,
            page_reset: false,
            count: 0,
            msg: [],
            settings: [],
            loaded_settings: false
        },
        computed: {
            email_filter() {
                let d = {};

                if (this.search !== "") {
                    d[this.search_by] = this.search;
                }
                if (this.status_filter !== "NOFILTER") {
                    d['status.code'] = this.status_filter;
                }
                if (this.date_filter__gt !== "") {
                    d['timestamp__gt'] = this.date_filter__gt;
                }
                if (this.date_filter__lt !== "") {
                    d['timestamp__lt'] = this.date_filter__lt;
                }

                return d;
            },
            isDisabled() {
                return (
                    this.search_by!== "id" || this.search.length > 0 || this.status_filter !== "NOFILTER" || this.date_filter__gt.length > 0 || this.date_filter__lt.length > 0
                    )
            },
            has_error() {
                return (
                    (typeof this.error) !== 'undefined' &&
                    this.error !== '' &&
                    this.error !== null &&
                    this.error !== false
                )
            }
        },
        watch: {
            search(val) {
                // text input validation
                if (val.match(/[\\/$?]/)) {
                    //console.log(this);
                    //notie.alert({type: 'error', text: 'Forbidden special character(s) in text search input: <b>&quot;'+val+'&quot;</b>'});
                    $('#text_search').focus();
                    $('#text_search').css('color','red');
                    //this.search = this.search.slice(0,-1);
                    return;
                } else {
                    $('#text_search').css('color', 'initial');
                    if (this.settings.filters) {
                        this.saveFilters();
                    }
                }
                this.reset_page();
                debounce_emails();
            },
            search_by(val) {
                if (this.search !== "") {
                    if (this.settings.filters) {
                        this.saveFilters();
                    }
                    this.reset_page();
                    debounce_emails();
                }
            },
            status_filter(val) {
                if (this.settings.filters) {
                    this.saveFilters();
                }
                this.reset_page();
                debounce_emails();
            },
            date_filter__gt(val) {
                if (this.settings.filters) {
                    this.saveFilters();
                }
                debounce_emails();
            },
            date_filter__lt(val) {
                if (this.settings.filters) {
                    this.saveFilters();
                }
                debounce_emails();
            },
            page(val) {
                //save current page
                this.saveCurPage();
                if (this.page_reset) return;
                debounce_emails();
                //this.loadEmails();
            },
            loaded_settings(newVal, oldVal) {
                if (oldVal === false && newVal === true) {
                    debounce_emails();
                }
            }
        },
        methods: {
            ToggleStickyHeader() {
                $('.hide-sticky-header-button i').toggleClass('down').toggleClass('up');
                if ($('.tablesorter-sticky-wrapper').position().top != -320) {
                    $('.tablesorter-sticky-wrapper').animate({
                        top: ($('.tablesorter-sticky-wrapper').position().top - 320)
                    })
                } else {
                    $('.tablesorter-sticky-wrapper').animate({
                        top: ($('.tablesorter-sticky-wrapper').position().top + 320)
                    })
                }
            },
            apply_marquee(found_table,vue) {              
                // do not marquee in mobile mode
                if (window.matchMedia('(min-width: 767px)').matches) {
                    found_table.on('resize', function(event, columns) {
                        //console.log("Table resize fired!");
                        $(".emails-list td:not(:last-child):not(.exclude-marquee)").unbind().marquee();
                    });
                    $(".emails-list td:not(:last-child):not(.exclude-marquee), .emails-list th:not(.exclude-marquee)").marquee();
                    //$(".emails-list td:not(:last-child):not(.exclude-marquee)").marquee();
                }
                // to reload email on window resize - commented - breaks mobile mode with constant refreshes
                /*var doit;
                window.onresize = function(){
                    clearTimeout(doit);
                    doit=setTimeout(vue.loadEmails, 500);
                    //console.log("Window resize fired!");
                }*/
            },
            reset_page() {
                this.page_reset = true;
                this.page_count = 1;
                this.page = 1;
                this.page_reset = false;
            },
            format_date(text,format,tz) {
                if (tz) {
                    var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
                    return moment(new Date(text) - tzoffset).utc().format(format);
                } else {
                    return moment(new Date(text)).utc().format(format);
                }
                //var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
                //return (new Date (new Date(text) - tzoffset)).toISOString();
                //return moment(new Date(text)).utc().format(format);
            },
            loadEmails() {
                // show loading modal on emails load
                $('#loading-modal').modal({closable: false,blurring: this.settings.blurring,inverted: true}).modal('show');
                //fix stickyheader on reload
                $('table.tablesorter-stickyHeader').find('thead').remove();
                this.loading = true;
                var url = base_url, queries = 0;

                //console.log("Current filters: "+JSON.stringify(this.email_filter));
                for (var f in this.email_filter) {
                    url += (queries === 0) ? '?' : '&';
                    url += `${f}=${this.email_filter[f]}`;
                    queries += 1;
                }

                url += (queries === 0) ? '?' : '&';
                url += `page=${this.page}&limit=${this.settings.page_limit}`;
                

                return fetch(url).then(function (response) {
                    return response.json();
                }).then((res) => {
                    this.emails = res['result'];
                    // format timestamp to current locale
                    // get format from .env var
                    if (datetime_format != '') {
                        for (let i = 0; i < this.emails.length; i++) {
                            //console.log(this.emails[i]);
                            this.emails[i].timestamp = this.format_date(this.emails[i].timestamp,datetime_format,false);
                            this.emails[i].first_attempt = this.format_date(this.emails[i].first_attempt,datetime_format,false);
                            this.emails[i].last_attempt = this.format_date(this.emails[i].last_attempt,datetime_format,false);
                            /*this.emails[i].timestamp = new Date(this.emails[i].timestamp).toLocaleString("ru-RU", { timeZone: 'UTC' });
                            this.emails[i].first_attempt = new Date(this.emails[i].first_attempt).toLocaleString("ru-RU", { timeZone: 'UTC' });
                            this.emails[i].last_attempt = new Date(this.emails[i].last_attempt).toLocaleString("ru-RU", { timeZone: 'UTC' });*/
                        }
                    }
                     
                    this.page_count = res['total_pages'];
                    this.count = res['count'];
                    this.loading = false;

                    $('#loading-modal').modal('hide');

                    // samoilov add table sort jquery function to columns and marquee to cells
                    this.$nextTick(function () {
                        //$(".emails-list td, .emails-list th").unbind();
                        //$(this.$el).find('table').tablesort().addClass('sortable celled');

                        $found_table = $(this.$el).find('.emails-list');
                        // cleanup before tablesorter() call
                        $('.tablesorter-resizable-container').remove();
                        $('.tablesorter-sticky-hidden').remove();
                        $('.tablesorter-sticky-visible').remove();

                        $found_table.tablesorter({
                            headers: {9: {sorter: false}},
                            widgets: [ 'resizable', 'StickyHeaders'],
                            widgetOptions: {
                                resizable: true,
                                //resizable_addlastcolumn : true,
                                resizable_widths : [ ,,,,,,,,,'100px' ]
                            }
                         });

                        // to fix tablesorter resizable handlers height
                        $('.tablesorter-resizable-handle').css('max-height', $found_table.height());

                        // to deny show button resize
                        $('.tablesorter-resizable-container div').eq(-2).remove();

                        // to clone right click event to the cloned header
                        var contextMenu_event_data = jQuery._data( $found_table.find('thead')[0], "events" );
                        $('table.tablesorter-stickyHeader').find('thead').bind("contextmenu", contextMenu_event_data['contextmenu'][0].handler);

                        // add show/hide sticky header button 
                        if (window.matchMedia('(max-width: 768px)').matches)
                        {
                            $('.tablesorter-sticky-wrapper').append('<div class="hide-sticky-header-button"><i class="ui chevron up icon"></i></div>');
                            window.onscroll = function(){
                                if ($('.tablesorter-sticky-wrapper').hasClass('tablesorter-sticky-visible') && ($('.tablesorter-sticky-wrapper').position().top != -320)) {
                                    $('.hide-sticky-header-button i').removeClass('down').addClass('up');
                                } else {
                                    $('.hide-sticky-header-button i').removeClass('up').addClass('down');
                                }
                            }
                        }
                        $('.hide-sticky-header-button').on( "click", function() {
                            window.app.ToggleStickyHeader();
                        });


                         //fix of refresh button
                        $('.refresh-button').on( "click", function() {
                            window.app.loadEmails();
                        });
                        // to reapply marquee
                        if (this.settings.marquee) {
                            this.apply_marquee($found_table, this);
                        }
                        // styling of statuses and status filter dropdown
                        $('.tablesorter td:nth-child(3):contains("deferred")').prepend(this.settings.status_icon['deferred']);
                        $('.tablesorter td:nth-child(3):contains("sent")').prepend(this.settings.status_icon['sent']);
                        $('.tablesorter td:nth-child(3):contains("reject")').prepend(this.settings.status_icon['reject']);
                        $('.tablesorter td:nth-child(3):contains("bounced")').prepend(this.settings.status_icon['bounced']);
                        if (this.settings.colored) {
                            var filter_email = $('#filter-email');
                            //console.log(this.settings.status_color);
                            $('.tablesorter td:contains("NOFILTER")').closest('tr').css('background-color',this.settings.status_color['NOFILTER']);
                            $('#filter-email option[value="NOFILTER"]').css('background-color',this.settings.status_color['NOFILTER']);
                            $('.tablesorter td:contains("deferred")').closest('tr').css('background-color',this.settings.status_color['deferred']);
                            $('#filter-email option[value="deferred"]').css('background-color',this.settings.status_color['deferred']);
                            $('.tablesorter td:contains("sent")').closest('tr').css('background-color',this.settings.status_color['sent']);
                            $('#filter-email option[value="sent"]').css('background-color',this.settings.status_color['sent']);
                            $('.tablesorter td:contains("reject")').closest('tr').css('background-color',this.settings.status_color['reject']);
                            $('#filter-email option[value="reject"]').css('background-color',this.settings.status_color['reject']);
                            $('.tablesorter td:contains("bounced")').closest('tr').css('background-color',this.settings.status_color['bounced']);
                            $('#filter-email option[value="bounced"]').css('background-color',this.settings.status_color['bounced']);

                            //console.log("Selected "+filter_email[0].value+" color: "+filter_email[0].options[filter_email[0].selectedIndex].style.backgroundColor);
                            filter_email.css("background-color", filter_email[0].options[filter_email[0].selectedIndex].style.backgroundColor);

                            filter_email.one('change', function () {
                                //console.log("Selected "+filter_email[0].value+" color: "+filter_email[0].options[filter_email[0].selectedIndex].style.backgroundColor);
                                //$(this).css("background-color", $('#filter-email option[value="'+$(this).val()+'"]').css("background-color"));
                                filter_email.css("background-color", filter_email[0].options[filter_email[0].selectedIndex].style.backgroundColor);
                            }); 
                        }
                    });
                    // samoilov add calendar date picker fields
                    var min_date=new Date();
                    min_date.setDate(min_date.getDate()-housekeeping_days);
                    console.log()
                    $('#rangestart').calendar({
                      onChange: function(date, text, mode) {
                          //console.log('change: ' + date + "  text: " + text + "  mode: " + mode)
                          //samoilov fomat date to iso8601
                          window.app.date_filter__gt = text;
                          //var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
                          //window.app.date_filter__gt = window.app.format_date(text,'',false);
                          //console.log(window.app);
                      },
                      endCalendar: $('#rangeend'),
                      monthFirst: false,
                      minDate: min_date,
                      maxDate: new Date(Date.now()),
                      //type: 'datetime',
                      formatter: {
                        cellTime: 'H:mm',
                        //datetime: 'DD.MM.Y, H:mm',
                        //datetime: 'YYYY-MM-DDTHH:mm:ss.sssZ'
                        datetime: datetime_format
                      }
                    });
                    $('#rangeend').calendar({
                      onChange: function(date, text, mode) {
                          //console.log('change: ' + date + "  text: " + text + "  mode: " + mode)
                          //samoilov fomat date to iso8601
                          window.app.date_filter__lt = text;
                          //var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
                          //var localTime_temp = new Date(text);
                          //window.app.date_filter__lt = (new Date (new Date(text) - tzoffset)).toISOString();
                          //window.app.date_filter__lt = window.app.format_date(text,'',false);
                          $(".ui.popup.left").removeClass("visible").addClass("invisible");
                          //$('#rangestart').calendar('clear');
                          //console.log(window.app);
                      },
                      startCalendar: $('#rangestart'),
                      monthFirst: false,
                      minDate: min_date,
                      maxDate: new Date(Date.now()),
                      //type: 'datetime',
                      formatter: {
                        cellTime: 'H:mm',
                        //datetime: 'DD.MM.Y, H:mm'
                        datetime: datetime_format
                      }
                    });
                }).catch((res) => {
                    console.error('Error:', res);
                });
            },
            show_modal(m) {
                //console.log(m.status.code);
                this.msg = m;
                $('#mail-modal').modal({
                onHidden: function () {
                    $('body').removeClass('scrolling');
                },
                    closable: true,
                    inverted: false,
                    blurring: this.settings.blurring
                }).modal('show');
                // samoilov fix of semantic ui scrolling appear on the many related log lines modals
                $('body').addClass('scrolling');
                // apply styling to modal
                this.$nextTick(function () {
                    $('#mail-modal > div.header > span > i').remove();
                    $('#mail-modal > div.header > span').prepend(this.settings.status_icon[m.status.code]);
                    if (this.settings.colored) {
                        //$('#email-metadata td:nth-child(2):contains("deferred")').css('background-color',this.settings.status_color[m.status.code]);
                        $('#email-metadata td:contains("'+m.status.code+'")').css('background-color',this.settings.status_color[m.status.code].slice(0, -2) + '.4)');
                        $('.ui.modal>.header').css('background-color',this.settings.status_color[m.status.code].slice(0, -2) + '.4)');

                    } else {
                        $('#email-metadata td:contains("'+m.status.code+'")').css('background-color',this.settings.status_color['NOFILTER']);
                        $('.ui.modal>.header').css('background-color',this.settings.status_color['NOFILTER']);
                    }
                });
            },
            settings_saved(val) {
                this.onSettingsUpdated(val);
                notie.alert({type: 'success', text: 'User settings are saved successfully'});
            },
            settings_loaded(val) {
                this.onSettingsUpdated(val);
                //notie.alert({type: 'info', text: `User settings are loaded from Local Storage`, time: 2})
            },
            saveFilters() {
                window.localStorage['saved_filters.search']=this.search;
                window.localStorage['saved_filters.status_filter']=this.status_filter;
                window.localStorage['saved_filters.search_by']=this.search_by;
                window.localStorage['saved_filters.date_filter__gt']=this.date_filter__gt;
                window.localStorage['saved_filters.date_filter__lt']=this.date_filter__lt;
                //console.log("Filters are saved!");

            },
            loadFilters() {
                if ('saved_filters.search' in window.localStorage) {
                    this.search = window.localStorage['saved_filters.search'];
                }
                if ('saved_filters.status_filter' in window.localStorage) {
                    this.status_filter = window.localStorage['saved_filters.status_filter'];
                }
                if ('saved_filters.search_by' in window.localStorage) {
                    this.search_by = window.localStorage['saved_filters.search_by'];
                }
                if ('saved_filters.date_filter__gt' in window.localStorage) {
                    this.date_filter__gt = window.localStorage['saved_filters.date_filter__gt'];
                }
                if ('saved_filters.date_filter__lt' in window.localStorage) {
                    this.date_filter__lt = window.localStorage['saved_filters.date_filter__lt'];
                }

                if ((this.search !== "") || (this.status_filter !=="NOFILTER") || (this.search_by !=="id") || (this.date_filter__gt !=="") || (this.date_filter__lt !=="")) {
                    notie.alert({type: 'warning', text: 'Saved filters are loaded successfully'});
                }
                //console.log("Filters are loaded!");
            },
            resetFilters() {
                this.search = "";
                this.status_filter = "NOFILTER";
                this.search_by = "id";
                // change start date based on saving filters option?
                if (this.settings.filters) {
                    this.date_filter__gt = "";
                } else {
                    this.setDuration();
                }
                //this.date_filter__gt = this.setDuration();
                this.date_filter__lt = "";
                $("#filter-email").css('background-color',this.settings.NOFILTER_color);
                notie.alert({type: 'warning', text: 'All filters are reset successfully'})
                //debounce_emails();
                this.reset_page();
            },
            saveCurPage() {
                window.localStorage['cur_page']=this.page;
            },
            setDuration() {
                // default start_date default_period minutes ago as gui option
                //var default_period = 10;
                if (this.settings.default_period) {
                    //var tzoffset = (new Date()).getTimezoneOffset() * 60000; //timezone offset in milliseconds
                    var startdate = new Date(new Date(Date.now()) - this.settings.default_period * 60000/* - tzoffset*/);
                    startdate = this.format_date(startdate,datetime_format,true);
                    //console.log(startdate);
                    this.date_filter__gt = startdate;
                    this.reset_page();
                };
            },
            loadCurPage() {
                if ('cur_page' in window.localStorage) {
                    this.page = Number.parseInt(window.localStorage['cur_page']);
                }
            },
            onSettingsUpdated(val) {
                let v = JSON.parse(JSON.stringify(val));
                v.page_limit = Number.parseInt(v.page_limit);
                v.default_period = Number.parseInt(v.default_period);
                //console.log(`[onSettingsUpdated] Old limit: ${this.settings.page_limit} | New Limit: ${v.page_limit}`);
                let updatePage = (v.default_period !== Number.parseInt(this.settings.default_period) || v.page_limit !== Number.parseInt(this.settings.page_limit) || v.marquee !== this.settings.marquee || v.colored !== this.settings.colored);

                this.settings = v;
                this.loaded_settings = true;

                if (updatePage) {
                    //console.log("[onSettingsUpdated] calling debounce_emails");
                    this.setDuration();
                    debounce_emails();
                    //location.reload();

                }
                // notie.alert('success', `User settings ${update_type} successfully`)
            },
        },
        mounted() {
            // this.loadEmails();
            // this.debounce_emails = _.debounce(this.loadEmails, 1000);
            //TODO need to fix dropdown update
            //$('select.dropdown').addClass("menu");
            //$('select.dropdown ').addClass("dropdown ui");

            // show loading modal on the page load
            $('#loading-modal').modal({closable: false,inverted: true,blurring: this.settings.blurring}).modal('show');
            $('select.dropdown option').addClass("item");  
            
            // TODO check setDuration option set
            this.setDuration();

            // load saved filters
            if (this.settings.filters) {
                this.loadFilters();
            }

            this.$nextTick(function () {
                // load saved page
                this.loadCurPage();
                // add back to the top button
                addBackToTop({
                  diameter: 56,
                  scrollDuration: 500,
                  backgroundColor: '#767676',
                  textColor: '#fff',
                  showWhenScrollTopIs: $(window).height()/2,
                  zIndex: 4,
                  cornerOffset: 30
                });
            });
        }
    });
});



