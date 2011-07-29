(function () {

    var filter = eval(Jscex.compile("seq", function (iter, predicate) {
        while (iter.moveNext()) {
            if (predicate(iter.current)) {
                $yield(iter.current);
            }
        }
    }));
    
    var map = eval(Jscex.compile("seq", function (iter, mapper) {
        while (iter.moveNext()) {
            $yield(mapper(iter.current));
        }
    }));

    var zip = eval(Jscex.compile("seq", function (iter1, iter2) {
        while (iter1.moveNext() && iter2.moveNext()) {
            $yield([iter1.current, iter2.current]);
        }
    }));

    var skip = eval(Jscex.compile("seq", function (iter, n) {
        for (var i = 0; i < n; i++) {
            if (!iter.moveNext()) {
                return;
            }
        }

        while (iter.moveNext()) {
            $yield(iter.current);
        }
    }));

    var take = eval(Jscex.compile("seq", function (iter, n) {
        var count = 0;
        while (iter.moveNext()) {
            if (count++ < n) {
                $yield(iter.current);
            }
        }
    }));

    var foreach = function (iter, action) {
        while (iter.moveNext()) {
            action(iter.current);
        }
    };

    var p = Jscex.Seq.Iterator.prototype;
    p.filter = function (predicate) { return filter(this, predicate); }
    p.map = function (mapper) { return map(this, mapper); }
    p.zip = function (iter) { return zip(this, iter); }
    p.skip = function (n) { return skip(this, n); }
    p.take = function (n) { return take(this, n); }
    p.foreach = function (action) { foreach(this, action); }

})();

