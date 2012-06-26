/**
 * Author: XiNGRZ <chenxingyu92@gmail.com>
 * 
 * Require.js paths configuration, application initialization.
 */

requirejs.config({
	'paths': {
		'jscex'					: '../../../src/jscex',
		'jscex-async'			: '../../../src/jscex-async',
		'jscex-async-powerpack'	: '../../../src/jscex-async-powerpack',
		'jscex-builderbase'		: '../../../src/jscex-builderbase',
		'jscex-jit'				: '../../../src/jscex-jit',
		'jscex-parser'			: '../../../src/jscex-parser',
		'jscex-promise'			: '../../../src/jscex-promise',
		
		'jscex-loader'	: './jscex-loader'
	}
});

require(['app'], function(App) {
	App.initialize();
});