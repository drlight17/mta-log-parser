window.addEventListener('load', () => {
    window.LocalSettings = Vue.component('local-settings', {
        template: `
        <div class="ui segment">
            <h3><i class="user icon"/> User settings</h3>
            <div class="ui form grid">
                <div class="ui column wide">
                    <div class="two fields">
                        <div class="field">
                        <label>Maximum results per page:</label>
                            <div class="ui input left icon">
                                <input v-model="settings.page_limit" type="number" class="ui input" placeholder="Results per Page">
                                <i class="list ol icon"/>
                                </div>
                        <label>Show last logs (minutes):</label>
                            <div id="default_period_div" class="ui input left icon">
                                <input disabled v-model="settings.default_period" type="number" class="ui input" placeholder="Amount of minutes">
                                <i class="clock icon"/>
                                </div>
                        </div>
                        <div class="field">
                            <div class="ui toggle checkbox" style="margin-top:0!important;">
                              <input v-model="settings.blurring" type="checkbox" title="Switch blur modal appearing effect if you have performance issues" >
                              <label>Blur effect</label>
                            </div>
                            <div class="ui toggle checkbox" style="margin-top:4px!important;">
                              <input v-model="settings.marquee" type="checkbox" title="Switch text ticker effect" >
                              <label>Marquee text</label>
                            </div>
                            <div class="ui toggle checkbox" style="margin-top:4px!important;">
                              <input v-model="settings.colored" type="checkbox" title="Switch status colored rows" >
                              <label>Colored rows</label>
                            </div>
                            <div class="ui toggle checkbox" style="margin-top:4px!important;">
                              <input v-model="settings.filters" type="checkbox" title="Save and load filters on page reload" >
                              <label>Save and load filters</label>
                            </div>
                        </div>        
                    </div>
                    <button id="savesettings" class="ui button primary" @click="saveSettings()" disabled><i class="save icon"></i>Save Settings</button>
                </div>
            </div>
        </div>`,
        
        name: 'local-settings',
        data() {
            return {
                // default gui settings
                'settings': {
                    page_limit: 50,
                    default_period: 20,
                    blurring: true,
                    marquee: true,
                    colored: true,
                    filters: true,
                    status_color: {
                        NOFILTER: 'rgba(255, 255, 255, 1)',
                        deferred: 'rgba(247, 201, 116, 1)',
                        sent: 'rgba(164, 237, 164, 1)',
                        reject: 'rgba(255, 175, 175, 1)',
                        bounced: 'rgba(186, 210, 245, 1)'
                    },
                    status_icon: {
                        deferred: "<i class='hourglass half icon'></i>",
                        sent: "<i class='check icon'></i>",
                        reject: "<i class='times icon'></i>",
                        bounced: "<i class='reply icon'></i>"
                    }
                },
            };

        },
        watch: {
            'settings.blurring': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            'settings.marquee': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            'settings.page_limit': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            'settings.default_period': function(val) {
                $('#savesettings').prop('disabled', false);
            },
            'settings.colored': function(val) {
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
                    $('#default_period_div > input').prop('disabled', false);
                });
            },
            disableDuration() {
                this.$nextTick(function () {
                    $('#default_period_div > input').prop('disabled', true);
                });
            },
            statusResetColors() {
                let s = this.settings;
                this.$nextTick(function () {
                    var filter_email = $('#filter-email');
                    $('#filter-email option[value="NOFILTER"]').css('background-color',s.status_color.NOFILTER);
                    $('#filter-email option[value="deferred"]').css('background-color',s.status_color.NOFILTER);
                    $('#filter-email option[value="sent"]').css('background-color',s.status_color.NOFILTER);
                    $('#filter-email option[value="bounced"]').css('background-color',s.status_color.NOFILTER);
                    $('#filter-email option[value="reject"]').css('background-color',s.status_color.NOFILTER);
                    filter_email.css("background-color", filter_email[0].options[filter_email[0].selectedIndex].style.backgroundColor);
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
                if ('page_limit' in window.localStorage)
                    s.page_limit = Number.parseInt(window.localStorage['page_limit']);

                if (isNaN(s.page_limit))
                    s.page_limit = 50;

                if ('default_period' in window.localStorage)
                    s.default_period = Number.parseInt(window.localStorage['default_period']);

                if (isNaN(s.default_period))
                    s.default_period = 20;

                if ('blurring' in window.localStorage) {
                    s.blurring = (window.localStorage['blurring']==="true");
                }
                
                if ('marquee' in window.localStorage) {
                    s.marquee = (window.localStorage['marquee']==="true");
                }

                if ('colored' in window.localStorage) {
                    s.colored = (window.localStorage['colored']==="true");
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
                if (isNaN(this.settings.page_limit)) { this.settings.page_limit = 50; }
                window.localStorage.page_limit = this.settings.page_limit;

                if (isNaN(this.settings.default_period)) { this.settings.default_period = 20; }
                this.settings.default_period = Number.parseInt(this.settings.default_period);
                if (isNaN(this.settings.default_period)) { this.settings.default_period = 20; }
                window.localStorage.default_period = this.settings.default_period;

                if (isNaN(this.settings.blurring)) { this.settings.blurring = true; }
                window.localStorage.blurring = this.settings.blurring;

                if (isNaN(this.settings.marquee)) { this.settings.marquee = true; }
                window.localStorage.marquee = this.settings.marquee;

                if (isNaN(this.settings.colored)) { this.settings.colored = true; }
                window.localStorage.colored = this.settings.colored;

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
});

