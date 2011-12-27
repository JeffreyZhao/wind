/*
	MIT License
	author: dh20156(风之石, dh20156@gmail.com)
	OYE: A module manager implementation of Asynchronous Module Definition
*/
(function(window){
	//如果之前已经载入过define库，则继续使用已有的对象
	if(window.define && window.define.amd){return;}
	var _define = window.define,//之前定义的window.define
		_require = window.require,//之前定义的window.require
		_path = (function(){//oye主文件路径
			var aJS = document.getElementsByTagName('script');
			var ret = aJS[aJS.length-1].src.replace(/\/[^\/]+$/, '');
			if(!/^[a-z]+?:\/\//.test(ret)){
				var sLocation = document.location.toString();
				//修正IE下相对路径不能返回完整的路径
				if(/^\//.test(ret)){
					ret = sLocation.replace(/((.*?\/){3}).*$/,'$1') + ret.substr(1);
				}else{
					ret = sLocation.replace(/[^\/]+$/, '') + ret;
				}
			}
			return ret;
		}()),
		_basePath = _path.replace(/\/[^\/]+$/, ''),//oye文件夹所在的父目录
		_rootPath = _path.replace(/((.*?\/){3}).*$/,'$1'),//oye文件所在的站点根目录
		_header = document.getElementsByTagName('head')[0],//<head>元素
		_maps = {},//模块地址对照表
		_modules = {},//已注册模块
		_holdon = {},//待转正模块
		_amdAnonymousID = null,//当前请求的匿名模块
		_dependenciesMap = {},//模块依赖映射表
		_mapDependencies = {},//被依赖模块映射表
		//取模块路径
		_fnGetPath = function(sKey, sExt){
			var aKey, sURL, sBaseURL = _basePath;
			if(!sExt){sExt = '.js';}
			if(_maps[sKey]){
				//如果传入的模块整段被匹配到有映射路径，则返回此映射路径
				sURL = _maps[sKey];
			}else if(/\.[^\/]*$/i.test(sKey)){
				//如果传入的模块是带扩展名的，则原样返回
				sURL = sKey;
			}else{
				sKey = sKey.replace(/\/$/,'');
				aKey = sKey.split('/');
				//先从_maps中定位首段匹配的URL
				sURL = _maps[aKey[0]];
				if(sURL){
					if(/\.[^\/]*$/.test(sURL)){
						//如果匹配到的是一个带扩展名的路径，则认为此首段匹配无效
						sURL = null;
					}else{
						sURL = sURL.replace(/\/$/,'');
					}
				}
				//如果没有注册，则视为与oye目录平级
				if(aKey.length === 1){
					sURL = sURL ? sURL+sExt : sBaseURL+'/'+sKey+sExt;
				}else{
					sURL = sURL ? sURL+'/'+aKey.slice(1).join('/')+sExt : sBaseURL+'/'+aKey.join('/')+sExt;
				}
			}
			if(/^\//.test(sURL)){
				//如果是根目录，将其路径补全
				sURL = _rootPath+sURL.replace(/\//,'');
			}else if(!/^[a-z]+?:\/\//.test(sURL)){
				//如果是相对目录，将其路径补全
				sURL = sBaseURL+'/'+sURL;
			}
			return sURL;
		},
		//请求超时定时器
		_timerRequire = null,
		//请求超时时间
		_maxTime = 30000,
		//加载JS文件
		_fnLoadJS = function(url, sModule, fnError){
			window.clearTimeout(_timerRequire);
			var module = _modules[sModule];
			//该模块已经载入过，不再继续加载，主要用于require与define在同一文件
			if(module && (module._amdReady || !module._amdFromRequire)){
				return;
			}
			var dHead, dScript;
			if(!url){
				fnError();
				return;
			}
			dHead = _header;
			dScript = document.createElement('script');
			dScript.setAttribute('src', url);
			dScript.setAttribute('type', 'text/javascript');
			dScript.setAttribute('language', 'javascript');
			dScript.onerror = fnError;
			dHead.appendChild(dScript);
			_timerRequire = window.setTimeout(function(){
				//处理浏览器不支持onerror的情况或真的请求超时
				if(sModule===_amdAnonymousID){fnError();}
			},_maxTime);
		},
		//请求队列，如果当前有一个模块正在被请求，则后来的请求全部进入队列
		_requireQueue = [],
		//执行请求队列
		_queueRequire = function(){
			if(_requireQueue.length){
				var module = _requireQueue.shift(), amdModule = module && _modules[module[0]];
				while(amdModule && amdModule._amdDependencies.join('')!==module[0]){
					module = _requireQueue.shift();
				}
				require.apply(null, module);
			}
		},
		/**
		* 检测模块是否存在循环引用
		* 当某个模块的依赖中出现了自己，则发生循环引用
		* @method _fnDetectCR
		* @static
		* @param {String} sMD 要检测的模块名
		* @param {Array} aDP 该模块的依赖模块
		* @return {String} 返回存在循环引用的模块名
		*/
		_fnDetectCR = function(sMD, aDP){
			if(!sMD){return;}
			if(aDP && aDP.constructor!==Array){return;}
			var i, DM, l = aDP.length, sDM, ret, _dpm = _dependenciesMap, _mdp = _mapDependencies;
			for(i=0;i<l;i++){
				sDM = aDP[i];
				if(sDM === sMD){return sDM;}//发现循环引用
				if(!_dpm[sMD]){_dpm[sMD] = {};}
				if(!_mdp[sDM]){_mdp[sDM] = {};}
				_dpm[sMD][sDM] = 1;
				_mdp[sDM][sMD] = 1;
			}
			for(DM in _mdp[sMD]){
				ret = arguments.callee(DM, aDP);
				if(ret){return ret;}
			}
		},
		//设置、获取模块
		_fnModule = function(sModule, value){
			var modules = _modules;
			if(typeof sModule === 'undefined'){return;}
			if(typeof value !== 'undefined'){
				modules[sModule] = value;
				//当传入的模块是已准备好的，开启转正机会
				if(!value._amdGetReady){_fnAMDReady(sModule);}
			}
			return modules[sModule];
		},
		/**
		* 将依赖某模块（已准备好的）的那些待转正模块开启转正服务
		* @method _fnAMDReady
		* @static
		* @param {String} sDependModule 已准备好的模块，字符串类型的JS模块名成，如：oye, app
		* @return {Void}
		*/
		_fnAMDReady = function(sDependModule){
			var md, i, l, hdModule = _holdon[sDependModule], modules = _modules;
			if(hdModule){
				l = hdModule.length;
				for(i=0; i<l; i++){
					md = modules[hdModule[i]];
					if(md && md._amdGetReady){
						md._amdGetReady();
						hdModule.shift();
						i--;
					}
				}
			}
		},
		/**
		* 加载依赖某模块
		* @method _loadDependencies
		* @static
		* @param {Array} aDependencies 要加载的依赖模块
		* @param {String} sFrom 命令来自于哪里：[define, other]
		* @return {Void}
		*/
		_loadDependencies = function(aDependencies, sFrom){
			if(!aDependencies || aDependencies.constructor!==Array || !aDependencies.length){return;}
			aDependencies = aDependencies.slice(0);
			(function(){
				if(!aDependencies.length){return;}
				var sDP = aDependencies.shift(), mDP = _modules[sDP];
				if(!mDP){
					require(sDP);//如果依赖模块不存在，则重新请求此模块
				}else if(sFrom!=='define' && mDP._amdGetReady && sDP!==mDP._amdDependencies[0]){
					//如果此请求不是来自于define，依赖模块有待转正，且非自我依赖的模块，则重新请求它的依赖模块
					_loadDependencies(mDP._amdDependencies);
				}
				arguments.callee();
			}());
		},
		/**
		* 模块定义类
		* @method _ClassModule
		* @static
		* @param {String} sModule 字符串类型的JS模块名成，如：oye, app
		* @param {Array} aDependencies 该模块依赖的模块名
		* @param {Function} fnBody 该模块的定义体，必须为函数类型（即传进来之前要进行转换）
		* @param {Boolean} bDeep 是否深入展开并加载依赖模块（用于require）
		* @return {Instance}
		*/
		_ClassModule = function(sModule, aDependencies, fnBody, bDeep){
			if(!sModule){return;}
			var i, l, sDP, aDP = [], mDP, fnErr = error, sMD, modules = _modules;
			this._amdID = sModule;
			this._amdDependencies = aDependencies;
			this._amdFactory = fnBody;
			if(!aDependencies || !aDependencies.length){
				//无依赖模块，直接转正
				this._amdGetReady();
			}else{
				l = aDependencies.length;
				if(l===1 && aDependencies[0]===sModule){
					//来自require的请求，模块依赖自己
					this._amdFromRequire = true;
					modules[sModule] = this;
				}else{
					//检测是否存在循环依赖
					sMD = _fnDetectCR(sModule, aDependencies);
					if(sMD){
						fnErr({fn:'define', msg:'There is a circular reference between "'+sMD+'" and "'+sModule+'"'});
						return;
					}
					//有依赖，加入待转正模块
					for(i=0;i<l;i++){
						sDP = aDependencies[i];
						mDP = modules[sDP];
						if(!mDP || mDP._amdGetReady){
							aDP.push(sDP);
							if(!_holdon[sDP]){
								_holdon[sDP] = [sModule];
							}else{
								_holdon[sDP].push(sModule);
							}
						}
					}
					if(!aDP.length){
						//依赖貌似都准备好，尝试转正
						this._amdGetReady();
					}else{
						modules[sModule] = this;
						if(bDeep){//深入加载依赖模块
							_loadDependencies(aDP, 'define');
						}
					}
				}
			}
		};
	//模块转正程序(模块已准备好)
	_ClassModule.prototype._amdGetReady = function(){
		var id = this._amdID, F, i, ad = this._amdDependencies, l = ad.length, md, aDM = [], aFnReady, modules = _modules;
		//检测当前模块是否可以转正
		for(i=0;i<l;i++){
			md = modules[ad[i]];
			//如果依赖模块未准备好，或依赖模块中还有待转正的模块，则当前模块也不能被转正
			if(!md || md._amdGetReady){return false;}
			aDM[i] = md;
		}
		this._amdReady = true;
		//将模块的原始定义体替换为该模块的实际定义体，如果实体定义没有返回结果，则将其置为一个空对象
		F = this._amdFactory.apply(null, aDM)||{};
		F._amdID = id;
		F._amdDependencies = ad;
		F._amdReady = true;
		F.todo = this.todo;
		F.getDependenciesMap = this.getDependenciesMap;
		aFnReady = this._amdReadyQueue[id]||[];
		//重置模块定义体，开启依赖此模块的其他模块的转正机会
		if(id){_fnModule(id,F);}
		//触发ready代码
		while(aFnReady.length){F.todo(aFnReady.shift());}
		return true;
	};
	//模块实例todo函数执行列表
	_ClassModule.prototype._amdReadyQueue = {};
	//取当前模块所有依赖模块
	_ClassModule.prototype.getDependenciesMap = function(){
		var sMD = this._amdID, MD = _dependenciesMap[sMD], DM, ret = [], fnGetPath = _fnGetPath, modules = _modules;
		ret.push(sMD+'['+modules[sMD]._amdReady+']: '+fnGetPath(sMD));
		for(DM in MD){
			ret.push(DM+'['+!!modules[DM]._amdReady+']: '+fnGetPath(DM));
		}
		return ret;
	};
	//引用模块后当该模块准备好时执行的方法
	_ClassModule.prototype.todo = function(fnX){
		var oModule, aDP, sMD = this._amdID;
		if(typeof fnX !== 'function'){return;}
		if(this._amdReady){
			fnX.call(this, this);//执行模块准备好时调用的代码
		}else{
			oModule = _modules[sMD];
			if(oModule && oModule._amdReady){oModule.todo(fnX);return;}//之前定义的模块实例无法同步，只能去找已准备好的模块
			if(!this._amdReadyQueue[sMD]){this._amdReadyQueue[sMD] = [];}
			this._amdReadyQueue[sMD].push(fnX);//压入准备执行队列
		}
	};
	/**
	* 请求载入指定的模块，如果全部模块都存在后，可以执行回调函数
	* @method require
	* @static
	* @param {String|Array} MD 指定的模块
	* @optional {Function} fnSuccess 模块加载成功时的回调函数function(模块形参){alert(模块形参);}
	* @optional {Function} fnFailure 模块加载失败时的回调函数
	* @return {Object} 返回_ClassModule实例
	*/
	var	require = function(sModule, fnSuccess, fnFailure){
		var fnGetPath = _fnGetPath, sURL, fnLoadJS = _fnLoadJS, fnErr = error;
		if(!sModule || typeof sModule!=='string'){return;}
		var ret = _modules[sModule]||new _ClassModule(sModule, [sModule], function(){return new String(sModule);});
		if(fnSuccess && typeof fnSuccess !== 'function'){
			fnErr({fn:'require', msg:'fnSuccess should be a Function'});
		}
		if(!fnFailure || fnFailure && typeof fnFailure !== 'function'){
			fnFailure = function(){
				fnErr({fn:'require', msg:'Could not load module: '+sModule+', Cannot fetch the file'});
			};
		}
		var bNamedModule = define.amd.namedModules[sModule];
		if(ret._amdDependencies.constructor===Array && ret._amdDependencies.join('')===sModule){
			if(_amdAnonymousID && !bNamedModule){
				//如果有某个模块正在处理中，且当前请求的模块不是已知的具名模块，则将当前请求丢到请求队列
				_requireQueue.push([sModule,fnSuccess,fnFailure]);
				return ret;
			}
			sURL = fnGetPath(sModule);
			if(!sURL){
				fnErr({fn:'require', msg:'Could not load module: '+sModule+', Cannot match its URL'});
			}
			//如果当前模块不是已知的具名模块，则设定它为正在处理中的模块，直到它的定义体出现
			if(!bNamedModule){_amdAnonymousID = sModule;}
			//如果define和require都在同一页面，则避免发出JS的请求
			window.setTimeout(function(){
				//加载此模块文件
				fnLoadJS(sURL, sModule, fnFailure);
			},0);
		}
		//如果模块准备好，则执行它的成功回调
		if(fnSuccess){ret.todo(fnSuccess);}
		return ret;
	},
	/**
	* 定义一个模块
	* @method define
	* @static
	* @param {String} id 模块名称
	* @param {Array} dependencies 该模块需要依赖的其他模块
	* @param {Function} factory 该模块的实体定义函数，如果是函数，则默认会将 [依赖对象] 传递至该函数以供该函数内部调用
	* @return {Any} 返回该模块的定义实体
	*/
	define = function(id, dependencies, factory){
		var args = [].slice.call(arguments,0), fnErr = error, bDeep, ret, fnBody = function(mDefine){
			//将factory强制转换为function类型，供ClassModule使用
			if(!mDefine){mDefine = '';}
			switch(typeof mDefine){
				case 'function':return mDefine;
				case 'string':return function(){return new String(mDefine);};
				case 'number':return function(){return new Number(mDefine);};
				case 'boolean':return function(){return new Boolean(mDefine);};
				default:return function(){return mDefine;};
			}
		};
		switch(args.length){
			case 0:
				fnErr({fn:'define', msg:'You need define something that cannot be null'});
				break;
			case 1:
				//定义匿名，无依赖模块
				id = _amdAnonymousID;
				dependencies = [];
				factory = fnBody(args[0]);
				break;
			case 2:
				if(typeof args[0] === 'string'||args[0].slice){
					//定义具名，无依赖模块或匿名，有依赖模块
					id = (typeof args[0] === 'string')?args[0]:_amdAnonymousID;
					dependencies = (args[0].constructor===Array)?args[0]:[];
					factory = fnBody(args[1]);
				}else{
					fnErr({fn:'define', msg:'The first arguments should be String or Array'});
				}
				break;
			default:
				//定义具名，有依赖模块
				if(typeof args[0] !== 'string' || args[1].constructor !== Array){
					fnErr({fn:'define', msg:'The two arguments ahead should be String and Array'});
				}
				factory = fnBody(args[2]);
		}
		bDeep = _modules[id];
		//如果该模块已经存在，且当前执行在require周期内，需要深入加载依赖模块
		bDeep = bDeep ? bDeep._amdFromRequire : false;
		ret = new _ClassModule(id, dependencies, factory, bDeep);
		//如果当前模块不是已知的具名模块，则重置正在处理中的模块名
		if(!define.amd.namedModules[id]){_amdAnonymousID = null;}
		//执行请求队列
		_queueRequire();
		return _modules[id];
	},
	/**
	* 抛出一个异常
	* @method error
	* @static
	* @param {Json} oError 错误对象，使用对象便于扩展
	* @return {Void}
	* @example	error({fn:'define', msg:'fnDefine is required'});
	*	//暂时只支持fn和msg两个字段，fn为发生错误时所在的函数名，msg为错误的描述信息
	*	//如果未传入该对象，则报：Uncaught error while run + 运行时函数体
	*/
	error = function(oError){
		var sError = (typeof oError !== 'object') ? 'Uncaught error while run '+arguments.callee.caller : 'Call '+oError.fn+'() error, '+oError.msg;
		throw new Error(sError);
	},
	/**
	* 设置、获取模块地址映射
	* @method config
	* @static
	* @param {String} sNamespace 字符串类型的JS模块名成，如：oye, app
	* @optional {String} sPath 指定JS模块名对应的JS文件路径
	* @return {String} 返回指定JS模块名对应的JS文件路径
	*/
	config = function(sNamespace, sPath){
		if(!sPath && typeof sNamespace==='object'){
			for(var k in sNamespace){
				arguments.callee(k, sNamespace[k]);
			}
			return;
		}
		var oMaps = _maps, fnErr = error;
		if(!sNamespace || typeof sNamespace!=='string'){
			fnErr({fn:'config', msg:'Get or Set path error, Namespace is required.'});
		}
		if(sPath){
			if(typeof sPath!=='string'){
				fnErr({fn:'config', msg:'Set path error, Path should be a string.'});
			}
			oMaps[sNamespace] = sPath;
		}else{
			return oMaps[sNamespace];
		}
	};
	define.amd = _maps;
	define.amd.namedModules = {};
	require.config = config;
	require.toUrl = function(str){
		if(!str||typeof str!=='string'){return;}
		if(/^(?:ftp|https?|wss?|file):/i.test(str)){return str;}
		var aStr = str.match(/^(.*?)(\.[^\.]*)$/);
		var ret = aStr?(_fnGetPath(aStr[1], aStr[2])):(_fnGetPath(str));
		return ret;
	};
	define.debug = function(){
		if(define._modules){
			delete define._modules;
		}else{
			define._modules = _modules;
		}
	};
	define.noConflict = function(){
		window.define = _define;
		return define;
	};
	require.noConflict = function(){
		window.require = _require;
		return require;
	};
	window.define = define;
	window.require = require;
}(window));