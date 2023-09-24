    app.component('stats', {
        template: `
        <div id="charts-wrapper" class="ui segment stackable two column grid">

            <div class="three wide column">
                <h3><i class="calendar outline icon"></i><i class="chart pie icon"></i><span v-if="$parent.localeData.overall_pie" v-html="$parent.localeData.overall_pie"></span><span v-else v-html="$parent.fallbackLocaleData.overall_pie"></span></h3>
                <div class="ui form">
                    <canvas v-if="!loading_overall_pie" id="overall_pie"></canvas>
                    <div v-else class="ui active huge indeterminate text loader">
                        <span v-if="$parent.localeData.loading" v-html="$parent.localeData.loading"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.loading"></span>
                    </div>
                </div>
            </div>

            <div class="three wide column">
                <h3><i class="filter icon"></i><i class="chart pie icon"></i><span v-if="$parent.localeData.filtered_pie" v-html="$parent.localeData.filtered_pie"></span><span v-else v-html="$parent.fallbackLocaleData.filtered_pie"></span></h3>
                <div class="ui form">
                    <canvas v-if="!loading_filtered_pie" id="filtered_pie"></canvas>
                    <div v-else class="ui active huge indeterminate text loader">
                        <span v-if="$parent.localeData.loading" v-html="$parent.localeData.loading"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.loading"></span>
                    </div>
                </div>
            </div>

            <div class="ten wide column">
                <h3><i class="chart bar icon"></i><span v-if="$parent.localeData.filtered_top_senders" v-html="$parent.localeData.filtered_top_senders"></span><span v-else v-html="$parent.fallbackLocaleData.filtered_top_senders"></span></h3>
                <div class="ui form">
                    <canvas v-if="!loading_filtered_top_senders" id="filtered_top_senders"></canvas>
                    <div v-else class="ui active huge indeterminate text loader">
                        <span v-if="$parent.localeData.loading" v-html="$parent.localeData.loading"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.loading"></span>
                    </div>
                </div>
                <h3><i class="chart bar outline icon"></i><span v-if="$parent.localeData.filtered_top_recipients" v-html="$parent.localeData.filtered_top_recipients"></span><span v-else v-html="$parent.fallbackLocaleData.filtered_top_recipients"></span></h3>
                <div class="ui form">
                    <canvas v-if="!loading_filtered_top_recipients" id="filtered_top_recipients"></canvas>
                    <div v-else class="ui active huge indeterminate text loader">
                        <span v-if="$parent.localeData.loading" v-html="$parent.localeData.loading"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.loading"></span>
                    </div>
                </div>
            </div>

        </div>`,
        data() {
            return {
                array_overall: {},
                array_filtered: {},
                array_filtered_top_senders: [],
                array_filtered_top_recipients: {},
                loading_overall_pie: false,
                loading_filtered_pie: false,
                loading_filtered_top_senders: false,
                loading_filtered_top_recipients: false,
                loading_filtered_throughoutput: false,
                noData_plugin: {
                  id: 'noData',
                  afterDraw(chart, args, options) {
	                const {datasets} = chart.data;
	                const {color, text_color, bg_color, width, radiusDecrease} = options;
	                let hasData = false;

	                for (let i = 0; i < datasets.length; i += 1) {
	                  const dataset = datasets[i];
	                  for (let j = 0; j < dataset.data.length; j += 1) {
	                    hasData |= (dataset.data[j] != 0 && typeof dataset.data[j] !== 'undefined' );
	                  }
	                }

	                if (!hasData) {
	                  const {chartArea: {left, top, right, bottom}, ctx} = chart;
	                  const centerX = (left + right) / 2;
	                  const centerY = (top + bottom) / 2;
	                  const r = Math.min(right - left, bottom - top) / 2;

	                  ctx.beginPath();
	                  ctx.lineWidth = width || 2;
	                  ctx.strokeStyle = color;
	                  ctx.globalCompositeOperation='destination-over'; // reverse z-index of canvas drawing
	                  if (chart.config._config.type == 'doughnut') {
	                  	ctx.arc(centerX, centerY, (r - radiusDecrease || 0), 0, 2 * Math.PI);
	                  	fontSize = (chart.height / 200).toFixed(2);
	                  } else {
						fontSize = (chart.height / 110).toFixed(2);
	                  }
	                  ctx.textAlign = 'center';
	                  ctx.textBaseline = 'top';
	                  ctx.font = fontSize + "rem Arial";
	                  var text_width = ctx.measureText(stats_app.$parent.localeData.no_data).width;
	                  //text color
	                  ctx.fillStyle = text_color;
	                  ctx.fillText(stats_app.$parent.localeData.no_data, chart.width / 2, chart.height / 2);
	                  // background color
	                  ctx.fillStyle = bg_color;
	                  ctx.fillRect(chart.width / 2 - text_width / 2, chart.height / 2 - ( fontSize * 1.5) / 2, text_width, parseInt(ctx.font, 10));

	                  ctx.stroke();
	                }
              	  },
                }
            }
        },
        props: {
        },
        computed: {
        },
        methods: {
            dynamicColors() {
                var r = Math.floor(Math.random() * 255);
                var g = Math.floor(Math.random() * 255);
                var b = Math.floor(Math.random() * 255);
                return "rgba(" + r + "," + g + "," + b + ", 0.5)";
            },
            poolColors(a) {
                var pool = [];
                for(i = 0; i < a; i++) {
                    pool.push(this.dynamicColors());
                }
                return pool;
            },
            async draw_chart(chart_type,mode) {
                if (mode == 1) {
                    try {
                        if (chart_type == 'filtered_top_senders') {
                            this.loading_filtered_top_senders = true;
                            let result = await this.call_stats_data(chart_type);
                            if (result == 1) {
                                this.draw_chart(chart_type,0);
                                return 0;
                            } else {
                                return 0;
                            }
                        }
                        if (chart_type == 'filtered_top_recipients') {
                            this.loading_filtered_top_recipients = true;
                            let result = await this.call_stats_data(chart_type);
                            if (result == 1) {
                                this.draw_chart(chart_type,0);
                                return 0;
                            } else {
                                return 0;
                            }
                        }


                    } catch (err) {

                    }   
                }

                var brightness = 0;
                var text_color = "black";
                var bgd_color = "white"
                if (this.$parent.settings.dark) {
                    brightness = -40;
                    text_color = "white";
                    bgd_color = "#2b2b2b"
                }

                var dataset = []
                var labels = []
                stats_app = this

                if (chart_type == 'filtered_top_senders') {
                    this.loading_filtered_top_senders = false;
                    this.array_filtered_top_senders.forEach((item, index) => {
                      dataset.push(item['count'])
                      labels.push(item['mail_from'])
                    })
                }

                if (chart_type == 'filtered_top_recipients') {
                    this.loading_filtered_top_recipients = false;
                    this.array_filtered_top_recipients.forEach((item, index) => {
                      dataset.push(item['count'])
                      labels.push(item['mail_to'])
                    })
                }

                var view_data = {
                  labels: labels,
                  datasets: [{
                    indexAxis: 'y',
                    data: dataset,
                    fill: false,
                    backgroundColor: stats_app.poolColors(dataset.length),
                    borderColor: 'rgba(128, 128, 128, 0.3)',
                    borderWidth: 1
                  }]
                };

                this.$nextTick(function () {
                    const ctx = document.getElementById(chart_type);
                    let chart = new Chart(ctx, {
                        type: 'bar',
                        data: view_data,
                        plugins: [stats_app.noData_plugin],
                        options: {
                            indexAxis: 'y',
                            plugins: {
                            	noData: {
                                        color: 'rgba(128, 128, 128, 0.3)',
                                        text_color: text_color,
                                        bg_color: bgd_color,
                                        width: 40,
                                        radiusDecrease: 20
                                    },
                                legend: {
                                  display: false
                                }
                            },
                            scales: {
                                x: {
                                 ticks: {
                                    fontColor: text_color,
                                    backdropColor: text_color,
                                    color: text_color,
                                    font: {
                                            size: 15
                                        }
                                    }
                                },
                                y: {
                                 ticks: {
                                    fontColor: text_color,
                                    backdropColor: text_color,
                                    color: text_color,
                                    font: {
                                            size: 15
                                        }
                                    }
                                 }
                            },
                            responsive: true,
                            maintainAspectRatio: false,
                        }
                    });
                });
            },
            async draw_donut(chart_type,mode) {
                if (mode == 1) {
                    // check cache in cookie with expiration
                    if (this.$parent.getCookie(chart_type)) {
                        this.loading_overall_pie = true;
                        // get cached data from cookie
                        data = JSON.parse(this.$parent.getCookie(chart_type));
                        if (chart_type == 'overall_pie') {
                            this.loading_overall_pie = false;
                        }
                    } else {
                        try {
                            if (chart_type == 'overall_pie') {
                                this.loading_overall_pie = true;
                                let result = await this.call_stats_data(chart_type);
                                if (result == 1) {
                                    this.draw_donut(chart_type,1);
                                    return 0;
                                } else {
                                    return 0;
                                }
                            }
                            if (chart_type == 'filtered_pie') {
                                this.loading_filtered_pie = true;
                                let result = await this.call_stats_data(chart_type);
                                if (result == 1) {
                                    this.draw_donut(chart_type,0);
                                    return 0;
                                } else {
                                    return 0;
                                }
                            }


                        } catch (err) {

                        }    
                    }
                } else {
                    this.loading_filtered_pie = false;
                    data = this.array_filtered;
                }

                var brightness = 0;
                var text_color = "black";
                var bgd_color = "white"
                if (this.$parent.settings.dark) {
                    brightness = -40;
                    text_color = "white";
                    bgd_color = "#2b2b2b"
                }

                stats_app = this
                var dataset = [data['sent'], data['deferred'], data['reject'], data['bounced'], data['unknown'], data['multiple']]
                

                var view_data = {
                    labels: ['sent', 'deferred', 'reject', 'bounced', 'unknown', 'multiple'],
                    datasets: [{
                        data: dataset,
                        backgroundColor: [
                            this.$parent.shadeColor(this.$parent.settings.status_color['sent'], brightness),
                            this.$parent.shadeColor(this.$parent.settings.status_color['deferred'], brightness),
                            this.$parent.shadeColor(this.$parent.settings.status_color['reject'], brightness),
                            this.$parent.shadeColor(this.$parent.settings.status_color['bounced'], brightness),
                            this.$parent.shadeColor(this.$parent.settings.status_color['unknown'], brightness),
                            this.$parent.shadeColor(this.$parent.settings.status_color['multiple'], brightness)
                        ],
                        hoverOffset: 4,
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label;
                                    let value = context.formattedValue;

                                    if (!label)
                                        label = 'Unknown'

                                    let sum = 0;

                                    let dataArr = context.chart.data.datasets[0].data;
                                    
                                    dataArr.map(data => {
                                    	if (typeof data !== 'undefined') {
                                        	sum += Number(data);
                                        }
                                    });
                                    let percentage = (value * 100 / sum).toFixed(2) + '%';
                                    return value + " (" + percentage + ")";
                                }
                            }
                        }
                    }],
                };

                this.$nextTick(function () {
                    const ctx = document.getElementById(chart_type);
                    let chart = new Chart(ctx, {
                        type: 'doughnut',
                        data: view_data,
                        plugins: [stats_app.noData_plugin],
                        options: {
                            plugins: {
                                noData: {
                                    color: 'rgba(128, 128, 128, 0.3)',
                                    text_color: text_color,
                                    bg_color: bgd_color,
                                    width: 40,
                                    radiusDecrease: 20
                                },
                                legend: {
                                    labels: {
                                        filter: (legendItem, data) => (
                                            data.datasets[0].data[legendItem.index] != 0 && typeof data.datasets[0].data[legendItem.index] !== 'undefined'
                                        ),
                                        color: text_color,
                                        font: {
                                            size: 15
                                        }
                                    }
                                },
                            },
                            responsive: true,
                            maintainAspectRatio: false,

                        }
                    });
                });
            },
            // function to fetch data for charts and save cache to cookies? or localStorage?
            async call_stats_data(chart_type){
               

                if (chart_type == 'overall_pie') {
                    var url = base_url3, queries = 0;
                    url += (queries === 0) ? '?' : '&';

                    //console.log("Fetch data for "+chart_type);
                    for (const element of ['sent','deferred','reject','bounced','unknown','multiple']) {
                      url_upd = url+`statuses=`+element;
                      await this.fetch_stats_data(url_upd,chart_type,element);
                    }
                    // store to cookie with expiration after hour
                    document.cookie = chart_type+"="+JSON.stringify(this.array_overall)+"; max-age=3600"
                    return 1;

                } else if (chart_type == 'filtered_pie') {
                    var url = base_url, queries = 0;
                    url += '?';
                    var element_status = '';

                    for (var f in this.$parent.email_filter) {
                        if (f != 'status.code') {
                            url += `${f}=${this.$parent.email_filter[f]}&`;
                            queries += 1;
                            
                        } else {
                            element_status = this.$parent.email_filter[f];
                        }
                    }
                    url += (queries === 0) ? '&' : '';

                    //console.log("Fetch data for "+chart_type);
                    if (element_status != '') {
                        url_upd = url+`status.code=`+element_status;
                        url_upd += `&page=${this.$parent.page}&limit=${this.$parent.settings.page_limit}`;
                        await this.fetch_stats_data(url_upd,chart_type,element_status);
                        return 1;
                    } else {
                        for (const element of ['sent','deferred','reject','bounced','unknown','multiple']) {
                          url_upd = url+`status.code=`+element;
                          url_upd += `&page=${this.$parent.page}&limit=${this.$parent.settings.page_limit}`;
                          await this.fetch_stats_data(url_upd,chart_type,element);

                        }
                        return 1;
                    }

                } else if (chart_type == 'filtered_top_senders'){
                    //console.log("Fetch data for "+chart_type);
                    var url = base_url3, queries = 0;
                    url += '?top_senders&';
                    for (var f in this.$parent.email_filter) {
                        url += `${f}=${this.$parent.email_filter[f]}&`;
                        queries += 1;
                    }
                    url_upd = url;
                    await this.fetch_stats_data(url_upd,chart_type,0);
                    return 1;
                    //console.log("Cache data");

                } else if (chart_type == 'filtered_top_recipients'){
                    //console.log("Fetch data for "+chart_type);
                    var url = base_url3, queries = 0;
                    url += '?top_recipients&';
                    for (var f in this.$parent.email_filter) {
                        url += `${f}=${this.$parent.email_filter[f]}&`;
                        queries += 1;
                    }
                    url_upd = url;
                    await this.fetch_stats_data(url_upd,chart_type,0);
                    return 1;
                    //console.log("Cache data");
                }

                return 0;
            },
            fetch_stats_data(url,chart_type,element){

                return fetch(url).then(function (response) {
                    return response.json();
                }).then((res) => {
                    if (chart_type == 'overall_pie') {
                        this.array_overall[element] = res[element];
                    }
                    if (chart_type == 'filtered_pie') {
                        this.array_filtered[element] = res['count'];
                    }
                    if (chart_type == 'filtered_top_senders') {
                        this.array_filtered_top_senders = res;
                    }
                    if (chart_type == 'filtered_top_recipients') {
                        this.array_filtered_top_recipients = res;
                    }
                }).catch((res) => {
                    console.error('Error:', res);
                });
            }
        },
        mounted() {
            // draw overall
            this.draw_donut('overall_pie', 1);
            // draw filtered
            this.draw_donut('filtered_pie', 1);
            // draw filtered top senders
            this.draw_chart('filtered_top_senders', 1);
            // draw filtered top recipients
            this.draw_chart('filtered_top_recipients', 1);
        }
    });

