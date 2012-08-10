var Wind = require("../../src/wind");
require("../../src/wind-compiler").init(Wind);
require("../../src/wind-async").init(Wind);

var fib = eval(Wind.compile("async", function () {

    $await(Wind.Async.sleep(1000));
    console.log(0);
    
    $await(Wind.Async.sleep(1000));
    console.log(1);

    var a = 0, current = 1;
    while (true) {
        var b = a;
        a = current;
        current = a + b;

        $await(Wind.Async.sleep(1000));
        console.log(current);
    }
}));

fib().start();
