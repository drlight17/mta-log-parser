    app.component('local-settings', {
        template: `
        <div id="user-settings-wrapper" class="ui segment">
            <h3><i class="user icon"/><span v-if="!$parent.loading" v-html="$parent.localeData.user_settings.user_settings_title"></span></h3>

            <div class="ui form grid">
                <div class="ui column wide">
                    <div class="two fields">
                        <div class="field">
                            <label v-if="!$parent.loading" v-html="$parent.localeData.user_settings.current_lang"></label>
                            <select name="cur-lang" id="cur-lang" v-model="settings.locale" class="ui selection dropdown">
                                <option v-for="(item, key) in $parent.locales" v-bind:value="key"> {{ item }}</option>
                            </select>
                            <p></p>
                            <div class="ui field"><i class="list ol icon"/><label style="display:inline" v-if="!$parent.loading" v-html="$parent.localeData.user_settings.page_limit"></label> {{ settings.page_limit }}</div>
                            <div class="ui input">
                                <input v-model="settings.page_limit" type="range" step="5" min="5" max="300" class="ui input range">
                            </div>
                            <div style="display:none" id="default_period_div">
                                <div v-if="!$parent.loading" :title="$parent.localeData.user_settings.show_last_min_title" class="ui field"><i class="clock icon"/><label style="display:inline" v-if="!$parent.loading" v-html="$parent.localeData.user_settings.show_last_min"></label> {{ settings.default_period_processed }} </div>
                                <div class="ui input">
                                    <input v-if="!$parent.loading" v-model="settings.default_period" type="range" step="5" min="5" max="4320" :title="$parent.localeData.user_settings.show_last_min_title" class="ui input range">
                                </div>
                            </div>
                            <div v-if="settings.refresh !== 0" class="ui field"><i class="sync icon"/><label style="display:inline" v-if="!$parent.loading" v-html="$parent.localeData.user_settings.refresh"></label> {{ settings.refresh }} <label style="display:inline" v-if="!$parent.loading" v-html="$parent.localeData.user_settings.refresh_end"></label></div>
                            <div v-else class="ui field"><i class="sync icon"/><label style="display:inline" v-if="!$parent.loading" v-html="$parent.localeData.user_settings.no_refresh"></label></div>
                            <div class="ui input">
                                <input v-model="settings.refresh" type="range" step="1" min="0" max="60" class="ui input range" placeholder="Amount of seconds">
                            </div>
                        </div>
                        <div class="field">
                            <div class="ui toggle checkbox">
                              <input v-if="!$parent.loading" v-model="settings.dark" type="checkbox" :title="$parent.localeData.user_settings.dark_title" >
                              <label v-if="!$parent.loading" v-html="$parent.localeData.user_settings.dark"></label>
                            </div>                        
                            <div class="ui toggle checkbox">
                              <input v-if="!$parent.loading" v-model="settings.blurring" type="checkbox" :title="$parent.localeData.user_settings.blur_title" >
                              <label v-if="!$parent.loading" v-html="$parent.localeData.user_settings.blur"></label>
                            </div>
                            <div class="ui toggle checkbox">
                              <input v-if="!$parent.loading" v-model="settings.sticky" type="checkbox" :title="$parent.localeData.user_settings.sticky_title" >
                              <label v-if="!$parent.loading" v-html="$parent.localeData.user_settings.sticky"></label>
                            </div>
                            <!--<div id="marquee_sw" class="ui toggle checkbox">
                              <input v-if="!$parent.loading" v-model="settings.marquee" type="checkbox" :title="$parent.localeData.user_settings.marquee_title" >
                              <label v-if="!$parent.loading" v-html="$parent.localeData.user_settings.marquee"></label>
                            </div>-->
                            <div class="ui toggle checkbox">
                              <input v-if="!$parent.loading" v-model="settings.colored" type="checkbox" :title="$parent.localeData.user_settings.colored_title" >
                              <label v-if="!$parent.loading" v-html="$parent.localeData.user_settings.colored"></label>
                            </div>
                            <div class="ui toggle checkbox">
                              <input v-if="!$parent.loading" v-model="settings.resizable" type="checkbox" :title="$parent.localeData.user_settings.resizable_title" >
                              <label v-if="!$parent.loading" v-html="$parent.localeData.user_settings.resizable"></label>
                            </div>
                            <div class="ui toggle checkbox">
                              <input v-if="!$parent.loading" v-model="settings.filters" type="checkbox" :title="$parent.localeData.user_settings.save_and_load_title" >
                              <label v-if="!$parent.loading" v-html="$parent.localeData.user_settings.save_and_load"></label>
                            </div>
                        </div>        
                    </div>
                    <button id="savesettings" class="ui button primary" @click="saveSettings()" disabled><i class="save icon"></i><span v-if="!$parent.loading" v-html="$parent.localeData.user_settings.save_settings"></span></button>
                </div>
            </div>
        </div>`,
        
        name: 'local-settings',
        data() {
            return {
                // default gui settings
                'settings': {
                    page_limit: 50,
                    default_period: 30,
                    default_period_processed: '',
                    refresh: 10,
                    sticky: true,
                    blurring: true,
                    dark: false,
                    //marquee: false,
                    colored: true,
                    resizable: false,
                    filters: false,
                    locale: "",
                    status_color: {
                        /*NOFILTER: 'rgba(255, 255, 255, 1)',
                        deferred: 'rgba(247, 201, 116, 1)',
                        sent: 'rgba(164, 237, 164, 1)',
                        reject: 'rgba(255, 175, 175, 1)',
                        bounced: 'rgba(186, 210, 245, 1)',
                        multiple: 'rgba(232, 179, 255, 1)',
                        unknown: 'rgba(249, 251, 140, 1)',
                        sorted: 'rgba(255, 255, 255, 0.4)'*/
                        NOFILTER: '#ffffff',
                        NOFILTER_dark: '#696969',
                        deferred: '#f7c974',
                        sent: '#a4eda4',
                        reject: '#ffafaf',
                        bounced: '#bad2f5',
                        multiple: '#e8b3ff',
                        unknown: '#f9fb8c',
                        sorted: 'rgb(255 255 255 / 30%)'
                    },
                    status_icon: {
                        deferred: "<i class='hourglass half icon'></i>",
                        sent: "<i class='check icon'></i>",
                        reject: "<i class='times icon'></i>",
                        bounced: "<i class='reply icon'></i>",
                        multiple: "<i class='tasks icon'></i>",
                        unknown: "<i class='question icon'></i>",
                        tls: "<i class='lock icon'></i>",
                        no_tls: "<i class='lock open icon'></i>"
                    }
                },
            };

        },
        watch: {
            'settings.blurring': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            'settings.dark': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            'settings.locale': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            'settings.sticky': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            /*'settings.marquee': function(val) {
                $('#savesettings').prop('disabled', false);
            },*/
            'settings.page_limit': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            'settings.default_period': function(val) {
                this.settings.default_period_processed = this.$parent.ConvertSeconds(val*60,false);
                $('#savesettings').prop('disabled', false);
            },
            /*'settings.refresh': _.debounce(function(val) {
                if (val < 10) {
                    this.settings.refresh = 10;
                    $('#savesettings').prop('disabled', true);
                } else {
                    this.settings.refresh = val;
                    $('#savesettings').prop('disabled', false);
                }
            }, 400),*/
            'settings.refresh': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            'settings.colored': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            'settings.resizable': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            'settings.filters': function(val) {
                $('#savesettings').prop('disabled', false);
            },
        },
        methods: {
            disableButton() {
                this.$nextTick(function () {
                    $('#savesettings').prop('disabled', true);
                });
            },
            enableDuration() {
                this.$nextTick(function () {
                    //$('#default_period_div > input').prop('disabled', false);
                    $('#default_period_div').show();
                });
            },
            disableDuration() {
                this.$nextTick(function () {
                    //$('#default_period_div > input').prop('disabled', true);
                    $('#default_period_div').hide();
                });
            },
            statusResetColors() {
                let s = this.settings;
                this.$nextTick(function () {
                    var filter_email = $('#filter-email');
                    $('#filter-email option[value="NOFILTER"]').css({'background-color': s.status_color.NOFILTER, 'color': 'black'});
                    $('#filter-email option[value="deferred"]').css('background-color',s.status_color.NOFILTER);
                    $('#filter-email option[value="sent"]').css('background-color',s.status_color.NOFILTER);
                    $('#filter-email option[value="bounced"]').css('background-color',s.status_color.NOFILTER);
                    $('#filter-email option[value="reject"]').css('background-color',s.status_color.NOFILTER);
                    $('#filter-email option[value="multiple"]').css('background-color',s.status_color.NOFILTER);
                    $('#filter-email option[value="unknown"]').css('background-color',s.status_color.NOFILTER);
                    //filter_email.css({"background-color": filter_email[0].options[filter_email[0].selectedIndex].style.backgroundColor, 'color': 'black'});
                });
            },
            clearFilters() {
                this.$nextTick(function () {
                    //console.log("Filters are cleared!");
                    window.localStorage.removeItem('saved_filters.search');
                    window.localStorage.removeItem('saved_filters.status_filter');
                    window.localStorage.removeItem('saved_filters.search_by');
                    window.localStorage.removeItem('saved_filters.date_filter__gt');
                    window.localStorage.removeItem('saved_filters.date_filter__lt');
                });
            },
            loadSettings() {
                let s = this.settings;

                if (isNaN(s.page_limit))
                    s.page_limit = 50;
                if ('page_limit' in window.localStorage)
                    s.page_limit = Number.parseInt(window.localStorage['page_limit']);

                if (isNaN(s.refresh))
                    s.refresh = 10;
                if ('refresh' in window.localStorage)
                    s.refresh = Number.parseInt(window.localStorage['refresh']);

                if (isNaN(s.default_period))
                    s.default_period = 30;
                if ('default_period' in window.localStorage)
                    s.default_period = Number.parseInt(window.localStorage['default_period']);
                this.$nextTick(function () {
                    s.default_period_processed = this.$parent.ConvertSeconds(s.default_period*60,false);
                })

                if ('locale' in window.localStorage)
                    s.locale = window.localStorage['locale'];

                if ('blurring' in window.localStorage) {
                    s.blurring = (window.localStorage['blurring']==="true");
                }

                if ('dark' in window.localStorage) {
                    s.dark = (window.localStorage['dark']==="true");
                }

                if ('sticky' in window.localStorage) {
                    s.sticky = (window.localStorage['sticky']==="true");
                }

                /*if ('marquee' in window.localStorage) {
                    s.marquee = (window.localStorage['marquee']==="true");
                }*/

                if ('colored' in window.localStorage) {
                    s.colored = (window.localStorage['colored']==="true");
                }

                if ('resizable' in window.localStorage) {
                    s.resizable = (window.localStorage['resizable']==="true");
                }

                if ('filters' in window.localStorage) {
                    s.filters = (window.localStorage['filters']==="true");
                }

                this.settings = s;

                this.$emit('settings-loaded', this.settings);
                return s;
            },

            saveSettings() {
                // isNaN is a little stupid, so we double check isNaN() both before and after we try
                // to convert it into an integer. If it's not a number, reset it back to 50.
                if (isNaN(this.settings.page_limit)) { this.settings.page_limit = 50; }
                this.settings.page_limit = Number.parseInt(this.settings.page_limit);
                window.localStorage.page_limit = this.settings.page_limit;


                if (isNaN(this.settings.refresh)) { this.settings.refresh = 10; }
                this.settings.refresh = Number.parseInt(this.settings.refresh);
                window.localStorage.refresh = this.settings.refresh;

                if (isNaN(this.settings.default_period)) { this.settings.default_period = 30; }
                this.settings.default_period = Number.parseInt(this.settings.default_period);
                window.localStorage.default_period = this.settings.default_period;
                
                //console.log(this.settings.locale);
                window.localStorage.locale = this.settings.locale;

                if (isNaN(this.settings.blurring)) { this.settings.blurring = true; }
                window.localStorage.blurring = this.settings.blurring;

                if (isNaN(this.settings.dark)) { this.settings.dark = true; }
                window.localStorage.dark = this.settings.dark;

                if (isNaN(this.settings.sticky)) { this.settings.sticky = true; }
                window.localStorage.sticky = this.settings.sticky;

                /*if (isNaN(this.settings.marquee)) { this.settings.marquee = true; }
                window.localStorage.marquee = this.settings.marquee;*/

                if (isNaN(this.settings.colored)) { this.settings.colored = true; }
                window.localStorage.colored = this.settings.colored;

                if (isNaN(this.settings.resizable)) { this.settings.resizable = true; }
                window.localStorage.resizable = this.settings.resizable;

                if (isNaN(this.settings.filters)) { this.settings.filters = true; }
                window.localStorage.filters = this.settings.filters;
                this.disableButton();

                if (!(this.settings.colored)) {
                    this.statusResetColors();
                }

                if (!(this.settings.filters)) {
                    this.enableDuration();
                    this.clearFilters();
                } else {
                    this.disableDuration();
                }

                this.$emit('settings-saved', this.settings);

                return this.settings;
            }

        },
        mounted() {
            this.loadSettings();
             if (!(this.settings.filters)) {
                this.enableDuration();
            }
            this.disableButton();
        }
    });


