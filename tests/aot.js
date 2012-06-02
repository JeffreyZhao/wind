"use strict";

var Jscex = require("../src/jscex");
require("../src/jscex-jit").init(Jscex);
require("../src/jscex-aot").init(Jscex);

require("should");

Jscex.logger.level = Jscex.Logging.Level.OFF;

describe("simple test", function () {

    it("should work", function () {

        var f = function () {
            eval(Jscex.compile("async", function () {
                $await(Jscex.Async.sleep(1000));
            }));
        }
    
        var newCode = Jscex.compileScript("var f = " + f.toString());
        newCode.match(/\$await/g).length.should.equal(1);
    });

});
