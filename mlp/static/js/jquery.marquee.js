$.fn.extend({
    marquee: function (options) {
        var marqueeProperties = $.extend({
            behavior: "scroll",
            direction: "left",
            loop: -1,
        }, options);
        return this.filter(function (index, element) {
            return (element.scrollWidth >= $(element).outerWidth());
        }).mouseenter(function () {
            $(this).wrapInner($("<marquee>").prop(marqueeProperties));
        }).mouseleave(function () {
            $(this).html($(this).find("marquee").html());
        }).end();
    }
});
