"use strict";

var exports = (typeof window === "undefined") ? module.exports : window;

exports.setupTests = function (Wind) {

    Wind.logger.level = Wind.Logging.Level.OFF;

    Wind.binders["async"] = "$await";
    
    describe("compile", function () {
        
        it("should pass if there're lonely semicolons", function () {
            Wind.compile("async", function () {
                ;;;
            });
        });
        
    });
}
