"use strict";

var Wind = require("../../../src/wind-core");
require("chai").should();

describe("define (CommonJS)", function () {

    var initialize = function (version) {
        Wind.modules = { core: { name: "core", version: version } };
        Wind.binders = { };
        Wind.builders = { };
    }
    
    it("should support simple module", function () {
        initialize("0.5.0");
    
        var initTimes = 0;
        
        Wind.define({
            name: "test",
            version: "0.5.0",
            dependencies: { core: "~0.5.0" },
            init: function () { initTimes++; }
        });

        initTimes.should.equal(1);
        
        Wind.modules["test"].should.eql({
            name: "test",
            version: "0.5.0",
            dependencies: { core: "~0.5.0" }
        });
    });
    
    it("should support complicated module", function () {
        var loaded = [];
        var require = function (name) {
            loaded.push(name);
        }
        
        initialize("0.5.5");
        Wind.modules["d0"] = { version: "0.1.0" };
        Wind.modules["d1"] = { version: "0.2.5" };
        
        var initTimes = 0;
        
        Wind.define({
            name: "test",
            version: "0.8.0",
            require: require,
            autoloads: [ "m0", "m1" ],
            dependencies: {
                core: "~0.5.0",
                d0: "~0.1.0",
                d1: "~0.2.0"
            },
            init: function () { initTimes++; }
        });

        loaded.should.eql([ "./wind-m0", "./wind-m1" ]);
        initTimes.should.equal(1);
        
        Wind.modules["test"].should.eql({
            name: "test",
            version: "0.8.0",
            autoloads: [ "m0", "m1" ],
            dependencies: {
                core: "~0.5.0",
                d0: "~0.1.0",
                d1: "~0.2.0"
            }
        });
    });

    it("should throw if module required an invalid core version", function () {
        initialize("0.5.0");

        var initTimes = 0;
        
        (function () {
            Wind.define({
                name: "test",
                version: "0.9.0",
                dependencies: { core: "~0.6.0" },
                init: function () { initTimes++; }
            });
        }).should.throw(/core.*expected.*actual/);
        
        initTimes.should.equal(0);
    });
    
    it("should throw if required module is not loaded", function () {
        initialize("0.5.0");

        var initTimes = 0;
        
        (function () {
            Wind.define({
                name: "test",
                version: "0.9.0",
                dependencies: {
                    core: "~0.5.0",
                    d0: "~0.1.0"
                },
                init: function () { initTimes++; }
            });
        }).should.throw(/required.*d0.*expected/);
        
        initTimes.should.equal(0);
    });

    it("should throw if the required module is loaded but has invalid version", function () {
        initialize("0.5.0");

        Wind.modules["d0"] = { version: "0.2.0" };

        var initTimes = 0;
        
        (function () {
            Wind.define({
                name: "test",
                version: "0.9.0",
                dependencies: {
                    core: "~0.5.0",
                    d0: "~0.1.0"
                },
                init: function () { initTimes++; }
            });
        }).should.throw(/d0.*expected.*actual/);
        
        initTimes.should.equal(0);
    });
});
