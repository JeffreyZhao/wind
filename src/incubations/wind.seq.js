Wind.Seq = { };

(function () {

    var SeqBuilder = function () { }

    var Iterator = Wind.Seq.Iterator = function (delegate) {
        this._delegate = delegate;
    }
    Iterator.prototype.moveNext = function () {

        var step = this._delegate();
        if (step) {
            this._delegate = step.nextDelegate;
            this.current = step.item;
            return true;
        } else {
            delete this._delegate;
            delete this.current;
            return false;
        }
    }

    var TempStep = null;

    SeqBuilder.prototype = {
        "binder": "$yield",

        "Start": function (_this, step) {

            var delegate = function () {
                TempStep = null;
                step.next(_this, function (type, value) {
                    if (type == "throw") console.log(value);
                });

                var tempStep = TempStep;
                TempStep = null;
                return tempStep;
            }

            return new Wind.Seq.Iterator(delegate);
        },

        "Bind": function (value, generator) {
            return {
                "next": function (_this, callback) {
                    TempStep = {
                        item: value,
                        nextDelegate: function () {
                            TempStep = null;
                            generator.call(_this).next(_this, callback);

                            var tempStep = TempStep;
                            TempStep = null;
                            return tempStep;
                        }
                    };
                }
            };
        }
    }

    for (var m in Wind.builderBase) {
        SeqBuilder.prototype[m] = Wind.builderBase[m];
    }

    Wind.builders["seq"] = new SeqBuilder();

})();
