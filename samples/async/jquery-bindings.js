(function () {

    var Task = Jscex.Async.Task;

    $.ajaxAsync = function (options) {
        return Task.create(function (t) {

            options.success = function (data, textStatus, jqXHR) {
                t.complete("success", {
                    data: data,
                    textStatus: textStatus,
                    jqXHR: jqXHR
                });
            }

            options.error = function (jqXHR, textStatus, errorThrow) {
                t.complete("failure", {
                    jqXHR: jqXHR,
                    textStatus: textStatus,
                    errorThrow: errorThrow
                });
            };

            $.ajax(options);
        });
    };
    
    if ($.fn.dialog) {
        $.fn.dialogAsync = function (options) {
            var _this = this;
            var result = null;

            return Task.create(function (t) {

                var close = options.close;
                options.close = function () {
                    t.complete("success", result)
                    if (close) close.call(this);
                }

                var buttons = options.buttons;
                if (buttons) {
                    for (var i = 0; i < buttons.length; i++) {
                        buttons[i].click = (function (value, click) {

                            return function() {
                                result = value;
                                if (click) click.call(this);
                            };

                        })(buttons[i].value, buttons[i].click);
                    }
                }

                _this.dialog(options);
            });
        }
    }

}($))(jQuery);
