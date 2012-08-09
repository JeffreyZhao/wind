/**
 * Author: XiNGRZ <chenxingyu92@gmail.com>
 * 
 * Jscex loader, returns a prepared Jscex object with jscex-jit, jscex-async, jscex-async-powerpack initialized.
 */

define([
    'jscex',
    'jscex-jit',
    'jscex-async',
    'jscex-async-powerpack'
], function (Jscex, jit, async, async_powerpack) {

    jit.init();
    async.init();
    async_powerpack.init();
    
    return Jscex;
});