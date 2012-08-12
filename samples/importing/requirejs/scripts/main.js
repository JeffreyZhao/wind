/***********************************************************************
  Author: XiNGRZ <chenxingyu92@gmail.com>

  Require.js paths configuration, application initialization.
 ***********************************************************************/

requirejs.config({
    'paths': {
        'wind-core'            : '../../../../src/wind-core',
        'wind-async'           : '../../../../src/wind-async',
        'wind-builderbase'     : '../../../../src/wind-builderbase',
        'wind-compiler'        : '../../../../src/wind-compiler',
        'wind-promise'         : '../../../../src/wind-promise',
        'wind'                 : './wind'
    }
});

require(["wind"], function (Wind) {
    var printInfiniteAsync = eval(Wind.compile("async", function () {
        var i = 0;
        while (++i) {
            document.write(i + "<br />");
            $await(Wind.Async.sleep(1000));
        }
    }));
    
    printInfiniteAsync().start();
});