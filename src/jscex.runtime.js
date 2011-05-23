/*
 *  Jscex runtime library
 *
 *    @author Riceball LEE
 *
 */
jcxGlobal = this;

JcxRuntime = {};

Jscex.compileEx = function(buildname, code) {
    return jcxGlobal.eval(Jscex.compile(buildname, code));
}

JcxRuntime.createXmlHttp = function() {
    var http = null;
	try{ http = new XMLHttpRequest(); }catch(e){}
	if (!http) try{ http = new ActiveXObject('Msxml2.XMLHTTP') }catch(e){}
	if (!http) try{ http = new ActiveXObject('Microsoft.XMLHTTP') }catch(e){}
	if (!http) try{ http = new ActiveXObject('Msxml2.XMLHTTP.4.0') }catch(e){}
	if (!http) throw new Error("XmlHTTP not available");
	return http;
}


