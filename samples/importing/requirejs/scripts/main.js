/**
 * Author: XiNGRZ <chenxingyu92@gmail.com>
 * 
 * Require.js paths configuration, application initialization.
 */

requirejs.config({
    'paths': {
        'wind'                 : '../../../../src/wind',
        'wind-async'           : '../../../../src/wind-async',
        'wind-async-powerpack' : '../../../../src/wind-async-powerpack',
        'wind-builderbase'     : '../../../../src/wind-builderbase',
        'wind-compiler'             : '../../../../src/wind-compiler',
        
        'wind-all'             : './wind-all'
    }
});

require(["wind-all"], function (Wind) {
    var printInfiniteAsync = eval(Wind.compile("async", function () {
        var i = 0;
        while (++i) {
            document.write(i + "<br />");
            $await(Wind.Async.sleep(1000));
        }
    }));
    
    printInfiniteAsync().start();
});