var p = Jscex.Seq.Iterator.prototype;

p.filter = eval(Jscex.compile("seq", function (predicate) {
    while (this.moveNext()) {
        if (predicate(this.current)) {
            $yield(this.current);
        }
    }
}));

p.map = eval(Jscex.compile("seq", function (mapper) {
    while (this.moveNext()) {
        $yield(mapper(this.current));
    }
}));

p.zip = eval(Jscex.compile("seq", function (iter) {
    while (this.moveNext() && iter.moveNext()) {
        $yield([this.current, iter.current]);
    }
}))

p.skip = eval(Jscex.compile("seq", function (n) {
    for (var i = 0; i < n; i++) {
        if (!this.moveNext()) {
            return;
        }
    }

    while (this.moveNext()) {
        $yield(this.current);
    }
}));

p.take = eval(Jscex.compile("seq", function (n) {
    var count = 0;
    while (this.moveNext()) {
        if (count++ < n) {
            $yield(this.current);
        }
    }
}));

p.foreach = function (action) {
    while (this.moveNext()) {
        action(this.current);
    }
}
