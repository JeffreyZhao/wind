"use strict";

var Wind = require("../../../src/wind");
require("chai").should();

describe("define (CommonJS)", function () {

    var initialize = function (version) {
        Wind.coreVersion = version;
        Wind.modules = { };
        Wind.binders = { };
        Wind.builders = { };
    }
    
    it("should support simple module", function () {
        initialize("0.5.0");
    
        var exports = {};
        var initTimes = 0;
        
        Wind.define({
            name: "test",
            version: "0.5.0",
            exports: exports,
            coreDependency: "~0.5.0",
            init: function () { 
                initTimes++;
                Wind.hello = "world";
            }
        });
        
        initTimes.should.equal(0);
        
        exports.name.should.equal("test");
        exports.version.should.equal("0.5.0");
        exports.coreDependency.should.equal("~0.5.0");
        
        exports.init();
        exports.init();
        exports.init();
        
        Wind.hello.should.equal("world");
        initTimes.should.equal(1);
        Wind.modules["test"].should.eql({
            name: "test",
            version: "0.5.0",
            coreDependency: "~0.5.0"
        });
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
        Wind.modules["d0"] = { version: "0.1.0" };
        Wind.modules["d1"] = { version: "0.2.5" };
        
        var exports = {};
        var initTimes = 0;
        
        Wind.define({
            name: "test",
            version: "0.8.0",
            exports: exports,
            require: require,
            autoloads: ["m0", "m1"],
            coreDependency: "~0.5.0",
            dependencies: { "d0": "~0.1.0", "d1": "~0.2.0" },
            init: function (root) {
                initTimes++;
                Wind.hello = "world";
            }
        });

        loaded.should.be.empty;
        initTimes.should.equal(0);
        
        exports.name.should.equal("test");
        exports.version.should.equal("0.8.0");
        exports.autoloads.should.eql([ "m0", "m1" ]);
        exports.coreDependency = "~0.5.0";
        exports.dependencies.should.eql({ "d0": "~0.1.0", "d1": "~0.2.0" });
        
        exports.init();
        exports.init();
        exports.init();
        
        loaded.should.eql(["./wind-m0", "./wind-m1"]);
        initTimes.should.equal(1);
        
        Wind.hello.should.equal("world");
        Wind.modules["test"].should.eql({
            name: "test",
            version: "0.8.0",
            autoloads: [ "m0", "m1" ],
            coreDependency: "~0.5.0",
            dependencies: { "d0": "~0.1.0", "d1": "~0.2.0" }
        });
    });

    it("should throw if module required an invalid core version", function () {
        initialize("0.5.0");

        var exports = {};
        var initTimes = 0;
        
        Wind.define({
            name: "test",
            version: "0.9.0",
            exports: exports,
            coreDependency: "~0.6.0",
            init: function () { initTimes++; }
        });
        
        (function () {
            exports.init();
        }).should.throw(/expected.*actual/);
        
        initTimes.should.equal(0);
    });
    
    it("should throw if required module is not loaded", function () {
        initialize("0.5.0");

        var exports = {};
        var initTimes = 0;
        
        Wind.define({
            name: "test",
            version: "0.9.0",
            exports: exports,
            coreDependency: "~0.5.0",
            dependencies: { "d0": "~0.1.0" },
            init: function () { initTimes++; }
        });
        
        (function () {
            exports.init();
        }).should.throw(/required.*expected/);
        
        initTimes.should.equal(0);
    });

    it("should throw if the required module is loaded but has invalid version", function () {
        initialize("0.5.0");
        Wind.modules["d0"] = { version: "0.2.0" };

        var exports = {};
        var initTimes = 0;
        
        Wind.define({
            name: "test",
            version: "0.9.0",
            exports: exports,
            coreDependency: "~0.5.0",
            dependencies: { "d0": "~0.1.0" },
            init: function () { initTimes++; }
        });
        
        (function () {
            exports.init();
        }).should.throw(/expected.*actual/);
        
        initTimes.should.equal(0);
    });
});
