"use strict";

var Jscex = require("../../../src/jscex");
require("chai").should();

describe("define (CommonJS)", function () {

    var initialize = function (version) {
        Jscex.coreVersion = version;
        Jscex.modules = { };
        Jscex.binders = { };
        Jscex.builders = { };
    }
    
    it("should support simple module", function () {
        initialize("0.5.0");
    
        var exports = {};
        var initTimes = 0;
        
        Jscex.define({
            name: "test",
            version: "0.5.0",
            exports: exports,
            dependencies: { core: "~0.5.0" },
            init: function () { 
                initTimes++;
                Jscex.hello = "world";
            }
        });
        
        exports.name.should.equal("test");
        exports.version.should.equal("0.5.0");
        initTimes.should.equal(0);
        
        exports.init();
        exports.init();
        exports.init();
        
        Jscex.hello.should.equal("world");
        Jscex.modules["test"].should.equal("0.5.0");
        initTimes.should.equal(1);
    });
    
    it("should support complicated module", function () {
        var loaded = [];
        var require = function (name) {
            return {
                init: function () {
                    loaded.push(name);
                }
            };
        }
        
        initialize("0.5.0");
        Jscex.modules["d0"] = "0.1.0";
        Jscex.modules["d1"] = "0.2.5";
        
        var exports = {};
        var initTimes = 0;
        
        Jscex.define({
            name: "test",
            version: "0.8.0",
            exports: exports,
            require: require,
            autoloads: ["m0", "m1"],
            dependencies: {
                "core": "~0.5.0",
                "d0": "~0.1.0",
                "d1": "~0.2.0"
            },
            init: function (root) {
                initTimes++;
                Jscex.hello = "world";
            }
        });

        loaded.should.be.empty;
        exports.name.should.equal("test");
        exports.version.should.equal("0.8.0");
        initTimes.should.equal(0);
        
        exports.init();
        exports.init();
        exports.init();
        
        loaded.should.eql(["jscex-m0", "jscex-m1"]);
        Jscex.hello.should.equal("world");
        Jscex.modules["test"].should.equal("0.8.0");
        initTimes.should.equal(1);
    });

    it("should throw if module required an invalid core version", function () {
        initialize("0.5.0");

        var exports = {};
        var initTimes = 0;
        
        Jscex.define({
            name: "test",
            version: "0.9.0",
            exports: exports,
            dependencies: { "core": "~0.6.0" },
            init: function () { initTimes++; }
        });
        
        (function () {
            exports.init();
        }).should.throw();
        
        initTimes.should.equal(0);
    });
    
    it("should throw if required module is not loaded", function () {
        initialize("0.5.0");

        var exports = {};
        var initTimes = 0;
        
        Jscex.define({
            name: "test",
            version: "0.9.0",
            exports: exports,
            dependencies: {
                "core": "~0.5.0",
                "d0": "~0.1.0"
            },
            init: function () { initTimes++; }
        });
        
        (function () {
            exports.init();
        }).should.throw();
        
        initTimes.should.equal(0);
    });

    it("should throw if the required module is loaded but has invalid version", function () {
        initialize("0.5.0");
        Jscex.modules["d0"] = "0.2.0";

        var exports = {};
        var initTimes = 0;
        
        Jscex.define({
            name: "test",
            version: "0.9.0",
            exports: exports,
            dependencies: {
                "core": "~0.5.0",
                "d0": "~0.1.0"
            },
            init: function () { initTimes++; }
        });
        
        (function () {
            exports.init();
        }).should.throw();
        
        initTimes.should.equal(0);
    });
});
