/**
 * Author: XiNGRZ <chenxingyu92@gmail.com>
 * 
 * Wind loader, returns a prepared Wind object with wind-compiler and wind-async initialized.
 */

define([
    'wind',
    'wind-compiler',
    'wind-async',
], function (Wind, compiler, async) {

    compiler.init();
    async.init();
    
    return Wind;
});