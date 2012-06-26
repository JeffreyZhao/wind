/**
 * Author: XiNGRZ <chenxingyu92@gmail.com>
 * 
 * Require.js paths configuration, application initialization.
 */

requirejs.config({
    'paths': {
        'jscex'                 : '../../../../src/jscex',
        'jscex-async'           : '../../../../src/jscex-async',
        'jscex-async-powerpack' : '../../../../src/jscex-async-powerpack',
        'jscex-builderbase'     : '../../../../src/jscex-builderbase',
        'jscex-jit'             : '../../../../src/jscex-jit',
        'jscex-parser'          : '../../../../src/jscex-parser',
        
        'jscex-all'             : './jscex-all'
    }
});

require(["jscex-all"], function (Jscex) {
    var printInfiniteAsync = eval(Jscex.compile("async", function () {
        var i = 0;
        while (++i) {
            document.write(i + "<br />");
            $await(Jscex.Async.sleep(1000));
        }
    }));
    
    printInfiniteAsync().start();
});