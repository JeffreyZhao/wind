(function () {
    "use strict";

    var Wind, _;
    
    var codeGenerator = (typeof eval("(function () {})") == "function") ?
        function (code) { return code; } :
        function (code) { return "false || " + code; };
        
    // support string type only.
    var stringify = (typeof JSON !== "undefined" && JSON.stringify) ?
        function (s) { return JSON.stringify(s); } :
        (function () {
            // Implementation comes from JSON2 (http://www.json.org/js.html)
        
            var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
            
            var meta = {    // table of character substitutions
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"' : '\\"',
                '\\': '\\\\'
            }
            
            return function (s) {
                // If the string contains no control characters, no quote characters, and no
                // backslash characters, then we can safely slap some quotes around it.
                // Otherwise we must also replace the offending characters with safe escape
                // sequences.

                escapable.lastIndex = 0;
                return escapable.test(s) ? '"' + s.replace(escapable, function (a) {
                    var c = meta[a];
                    return typeof c === 's' ? c :
                        '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                }) + '"' : '"' + s + '"';
            };
        })();
    
    function getPrecedence(ast) {
        switch (ast.type) {
            case "MemberExpression": // .
            case "dot": // .
            case "sub": // []
            case "call": // ()
                return 1;
            case "UpdateExpression":
            case "UnaryExpression":
            case "unary-postfix": // ++ -- - ~ ! delete typeof void
            case "unary-prefix":
                return 2;
            case "var":
            case "BinaryExpression":
                switch (ast.operator) {
                    case "*":
                    case "/":
                    case "%":
                        return 3;
                    case "+":
                    case "-":
                        return 4;
                    case "<<":
                    case ">>":
                    case ">>>":
                        return 5;
                    case "<":
                    case "<=":
                    case ">":
                    case ">=":
                    case "instanceof":
                        return 6;
                    case "==":
                    case "!=":
                    case "===":
                    case "!==":
                        return 7;
                    case "&":
                        return 8;
                    case "^":
                        return 9;
                    case "|":
                        return 10;
                    case "&&":
                        return 11;
                    case "||":
                        return 12;
                }
            case "conditional":
                return 13;
            case "assign":
                return 14;
            case "NewExpression":
            case "new":
                return 15;
            case "Literal":
            case "Identifier":
            case "seq":
            case "stat":
            case "name":
            case "object":
            case "array":
            case "num":
            case "regexp":
            case "string":
            case "function":
            case "defun":
            case "for":
            case "for-in":
            case "block":
            case "while":
            case "do":
            case "if":
            case "break":
            case "continue":
            case "return":
            case "throw":
            case "try":
            case "switch": 
                return 0;
            default:
                return 100; // the lowest
        }
    }
    
    var isSubset = function (full, partial) {
        if (full === partial) return true;
        
        if (typeof full !== typeof partial) return false
        switch (typeof full) {
            case "string":
            case "number":
            case "boolean":
            case "undefined":
                return full === partial;
        }
        
        if (full === null && partial !== null) return false;
        if (full !== null && partial === null) return false;

        if (_.isArray(full)) {
            if (!_.isArray(partial)) return false;
            if (full.length != partial.length) return false;

            for (var i = 0; i < full.length; i++) {
                if (!isSubset(full[i], partial[i])) return false;
            }

            return true;
        }
        
        if (_.isArray(partial)) return false;
        
        var result = _.each(partial, function (key, value) {
            if (!(key in full)) return false;
            if (!isSubset(full[key], value)) return false;
        });
        
        if (result === false) return false
        
        return true;
    };
    
    var SeedProvider = function () {
        this._seeds = {};
    }
    SeedProvider.prototype.next = function (key) {
        var value = this._seeds[key];
        if (value == undefined) {
            this._seeds[key] = 0;
            return 0;
        } else {
            this._seeds[key] = ++value;
            return value;
        }
    }
    
    var WindAstGenerator = function (builderName, seedProvider) {
        this._builderName = builderName;
        this._binder = Wind.binders[builderName];
        this._seedProvider = seedProvider || new SeedProvider();
    };
    WindAstGenerator.prototype = {
        generate: function (funcAst) {
            var rootAst = {
                type: "Function",
                name: funcAst.id ? funcAst.id.name : null,
                params: funcAst.params,
                body: { type: "Delay", children: [] }
            };

            this._generateStatements(funcAst.body.body, 0, rootAst.body.children);
            
            return rootAst;
        },
        
        _createBindAst: function (isReturn, name, assignee, expression) {
            return {
                type: "Bind",
                isReturn: isReturn,
                name: name,
                assignee: assignee,
                expression: expression,
                following: []
            };
        },
        
        _getBindAst: function (ast) {
            // $await(xxx);
            var exprStyle = {
                type: "ExpressionStatement",
                expression: {
                    type: "CallExpression",
                    callee: { type: "Identifier", name: this._binder }
                }
            };
            
            if (isSubset(ast, exprStyle)) {
                var args = ast.expression.arguments;
                if (args.length != 1) return;
                
                return this._createBindAst(false, "", null, args[0]);
            };
            
            // var a = $await(xxx);
            var varDeclStyle = {
                type: "VariableDeclaration",
                declarations: [ {
                    type: "VariableDeclarator",
                    id: {
                        type: "Identifier",
                    },
                    init: {
                        type: "CallExpression",
                        callee: {
                            type: "Identifier",
                            name: this._binder
                        }
                    }
                } ]
            };
            
            if (isSubset(ast, varDeclStyle)) {
                var declarator = ast.declarations[0];
                var args = declarator.init.arguments;
                if (args.length != 1) return;

                return this._createBindAst(false, declarator.id.name, null, args[0]);
            };
            
            // a.b = $await(xxx)
            var assignStyle = {
                type: "ExpressionStatement",
                expression: {
                    type: "AssignmentExpression",
                    operator: "=",
                    right: {
                        type: "CallExpression",
                        callee: {
                            type: "Identifier",
                            name: this._binder
                        }
                    }
                }
            };
            
            if (isSubset(ast, assignStyle)) {
                var assignExpr = ast.expression;
                var args = assignExpr.right.arguments;
                if (args.length != 1) return;
                
                return this._createBindAst(false, "_$result$_", assignExpr.left, args[0]);
            }
            
            // return $await(xxx);
            var returnStyle = {
                type: "ReturnStatement",
                argument: {
                    type: "CallExpression",
                    callee: {
                        "type": "Identifier",
                        "name": "$await"
                    }
                }
            };
            
            if (isSubset(ast, returnStyle)) {
                var args = ast.argument.arguments
                if (args.length != 1) return;
                
                return this._createBindAst(true, "_$result$_", null, args[0]);
            }
        },
        
        _generateStatements: function (statements, index, children) {
            if (index >= statements.length) {
                return;
            }
            
            var currStmt = statements[index];
            if (currStmt.type === "EmptyStatement") {
                this._generateStatements(statements, index + 1, children);
                return;
            }
            
            var bindAst = this._getBindAst(currStmt);
            
            if (bindAst) {
                children.push(bindAst);
                
                if (!bindAst.isReturn) {
                    this._generateStatements(statements, index + 1, bindAst.following);
                }
                
                return;
            }
            
            switch (currStmt.type) {
                case "ReturnStatement":
                case "BreakStatement":
                case "ContinueStatement":
                case "ThrowStatement":
                    children.push({ type: "Raw", statement: currStmt });
                    return;
            }
            
            this._generateAst(currStmt, children);
            
            if (index === statements.length - 1) return;
            
            if (children[children.length - 1].type === "Raw") {
                this._generateStatements(statements, index + 1, children);
                return;
            }
            
            var combineAst = {
                type: "Combine",
                first: { type: "Delay", children: [ children.pop() /* replace the last */ ] },
                second: { type: "Delay", children: [] }
            };
            
            children.push(combineAst);
            this._generateStatements(statements, index + 1, combineAst.second.children);
        },
        
        _noBinding: function (children) {
            if (!children) return true;
            if (children.length <= 0) return true;
            
            switch (children[children.length - 1].type) {
                case "Raw":
                case "Normal":
                    return true;
                default:
                    return false;
            }
        },
        
        _generateBodyStatements: function (body) {
            var bodyStatements = body.type == "BlockStatement" ? body.body : [ body ];
            
            var children = [];
            this._generateStatements(bodyStatements, 0, children);
            
            return children;
        },
        
        _generateAst: function (ast, children) {
            var generator = this._astGenerators[ast.type];
            if (!generator) {
                children.push({ type: "Raw", statement: ast });
                return;
            }
            
            generator.call(this, ast, children);
        },
        
        _astGenerators: {
            "WhileStatement": function (ast, children) {
                var bodyChildren = this._generateBodyStatements(ast.body);
                if (this._noBinding(bodyChildren)) {
                    children.push({ type: "Raw", statement: ast });
                    return;
                }
                
                children.push({
                    type: "While",
                    test: ast.test,
                    body: { type: "Delay", children: bodyChildren }
                });
            },
            
            "ForStatement": function (ast, children) {
                var bodyChildren = this._generateBodyStatements(ast.body);
                if (this._noBinding(bodyChildren)) {
                    children.push({ type: "Raw", statement: ast });
                    return;
                }
                    
                if (ast.init) {
                    children.push({ type: "Raw", statement: ast.init });
                }
                
                children.push({
                    type: "For",
                    test: ast.test,
                    update: ast.update,
                    body: { type: "Delay", children: bodyChildren }
                });
            },
            
            "IfStatement": function (ast, children) {
                var consequent = this._generateBodyStatements(ast.consequent);
                var alternate = ast.alternate ? this._generateBodyStatements(ast.alternate) : null;
                
                if (this._noBinding(consequent) && this._noBinding(alternate)) {
                    children.push({ type: "Raw", statement: ast });
                    return;
                }
                
                children.push({
                    type: "If",
                    test: ast.test,
                    consequent: consequent,
                    alternate: alternate
                });
            }
        }
    };
    
    var SourceMap = function (file, lineShift) {
        this.file = file;
        this._lineShift = lineShift;
        this._columnShift = 0;
        this._records = [];
    };
    SourceMap.prototype = {
        setColumnShift: function (columnShift) {
            this._columnShift = columnShift;
        },
        
        record: function (line, column, sourceLine, sourceColumn) {
            this._records.push({
                line: line,
                column: column,
                sourceLine: sourceLine,
                sourceColumn: sourceColumn
            });
        },
        
        getSourcePosition: function (line, column) {
            column -= this._columnShift;
            
            var record = _.each(this._records, function (r) {
                if (r.line === line && r.column === column) {
                    return r;
                }
            });
            
            if (!record) return;
            
            return {
                line: this._lineShift + record.sourceLine,
                column: record.sourceColumn
            };
        }
    }
    
    var CodeWriter = function (indent) {
        this._indent = indent || "    ";
        this._indentLevel = 0;
        
        this.lines = [ ];
    }
    CodeWriter.prototype = {
        recordPosition: function (sourceMap, sourcePos) {
            var line = this.lines.length;
            var column = this.lines[this.lines.length - 1].length;
            sourceMap.record(line, column, sourcePos.line, sourcePos.column);
        },
        
        write: function (str) {
            if (str === undefined) return;
            
            if (this.lines.length == 0) {
                this.lines.push("");
            }

            this.lines[this.lines.length - 1] += str;
            return this;
        },
        
        writeLine: function () {
            this.write.apply(this, arguments);
            this.lines.push("");
            return this;
        },
        
        writeIndents: function () {
            var indents = new Array(this._indentLevel);
            for (var i = 0; i < this._indentLevel; i++) {
                indents[i] = this._indent;
            }
            
            this.write(indents.join(""));
            return this;
        }, 
        
        addIndentLevel: function (diff) {
            this._indentLevel += diff;
            return this;
        }
    };
    
    var CodeGenerator = function (builderName, codeWriter, commentWriter, sourceMap, seedProvider) {
        this._builderName = builderName;
        this._binder = Wind.binders[builderName];
        
        this._codeWriter = codeWriter;
        this._commentWriter = commentWriter;

        this._sourceMap = sourceMap;
        this._seedProvider = seedProvider || new SeedProvider();
    }
    CodeGenerator.prototype = {
        _code: function () {
            this._codeWriter.write.apply(this._codeWriter, arguments);
            return this;
        },
        
        _codeLine: function () {
            this._codeWriter.writeLine.apply(this._codeWriter, arguments);
            return this;
        },
        
        _codeIndents: function () {
            this._codeWriter.writeIndents();
            return this;
        },
        
        _codeIndentLevel: function (diff) {
            this._codeWriter.addIndentLevel(diff);
            return this;
        },
        
        _comment: function () {
            this._commentWriter.write.apply(this._commentWriter, arguments);
            return this;
        },
        
        _commentLine: function () {
            this._commentWriter.writeLine.apply(this._commentWriter, arguments);
            return this;
        },
        
        _commentIndents: function () {
            this._commentWriter.writeIndents();
            return this;
        },
        
        _commentIndentLevel: function (diff) {
            this._commentWriter.addIndentLevel(diff);
            return this;
        },
        
        _both: function () {
            this._codeWriter.write.apply(this._codeWriter, arguments);
            this._commentWriter.write.apply(this._commentWriter, arguments);

            return this;
        },
        
        _bothLine: function () {
            this._codeWriter.writeLine.apply(this._codeWriter, arguments);
            this._commentWriter.writeLine.apply(this._commentWriter, arguments);
            
            return this;
        },
        
        _bothIndents: function () {
            this._codeWriter.writeIndents();
            this._commentWriter.writeIndents();
            
            return this;
        },
        
        _bothIndentLevel: function (diff) {
            this._codeWriter.addIndentLevel(diff);
            this._commentWriter.addIndentLevel(diff);
            
            return this;
        },
        
        _newLine: function () {
            this._codeWriter.writeLine.apply(this._codeWriter, arguments);
            this._commentWriter.writeLine(); // To Remove
            return this;
        },
        
        _recordPosition: function (ast) {
            this._codeWriter.recordPosition(this._sourceMap, ast.loc.start);
        },
        
        generate: function (windAst) {
            this._normalMode = false;
            this._builderVar = "_builder_$" + this._seedProvider.next("builderId");
            
            var funcName = windAst.name || "";
            var params = _.map(windAst.params, function (m) { return m.name; });
            
            this._code("(")._bothLine("function " + funcName + "(" + params.join(", ") + ") {");
            this._bothIndentLevel(1);
            
            this._codeIndents()._newLine("var " + this._builderVar + " = " + "Wind.builders[" + stringify(this._builderName) + "];");
            
            this._codeIndents()._newLine("return " + this._builderVar + ".Start(this,");
            this._codeIndentLevel(1);
            
            this._pos = { };
            
            this._bothIndents()._generateWind(windAst.body)._newLine();
            this._codeIndentLevel(-1);
            
            this._codeIndents()._newLine(");");
            this._bothIndentLevel(-1);
            
            this._bothIndents()._both("}")._code(")");
        },
        
        _requireLastNormal: function (statements) {
            if (statements.length === 0) return true;
            
            var last = statements[statements.length - 1];
            switch (last.type) {
                case "Raw":
                case "If":
                case "Switch":
                    return true;
                default:
                    return false;
            }
        },
        
        _generateWindStatements: function (statements) {
            for (var i = 0; i < statements.length; i++) {
                var stmt = statements[i];

                switch (stmt.type) {
                    case "Delay":
                        this._generateWindStatements(stmt.children);
                        break;
                    case "Raw":
                        this._generateRaw(stmt.statement);
                        break;
                    case "If":
                    case "Switch":
                        this._bothIndents()._generateWind(stmt)._newLine();
                        break;
                    default:
                        this._bothIndents()._code("return ")._generateWind(stmt)._newLine(";");
                        break;
                }
            }
            
            if (this._requireLastNormal(statements)) {
                this._bothIndents()._code("return ")._generateWind({ type: "Normal"})._newLine(";");
            }
        },
        
        _generateWind: function (ast) {
            var generator = this._windGenerators[ast.type];
            if (!generator) {
                debugger;
                throw new Error("Unsupported type: " + ast.type);
            }
            
            generator.call(this, ast);
            return this;
        },
        
        _windGenerators: {
            Delay: function (ast) {
                var children = ast.children;
                
                if (children.length === 0) {
                    this._generateWind({ type: "Normal" });
                } else if (children.length === 1) {
                    var child = children[0];
                    switch (child.type) {
                        case "Delay":
                        case "Combine":
                        case "While":
                        case "For":
                            this._generateWind(child);
                            return;
                    }
                    
                    if (child.type === "Raw" && 
                        child.statement.type === "ReturnStatement" &&
                        child.statement.argument === null) {
                        
                        this._generateWind(child);
                        return;
                    }
                }
                
                this._newLine(this._builderVar + ".Delay(function () {");
                this._codeIndentLevel(1);

                this._generateWindStatements(children);
                this._codeIndentLevel(-1);

                this._codeIndents()._code("})");
            },
            
            Bind: function (ast) {
                var commentPrefix = "";
                if (ast.isReturn) {
                    commentPrefix = "return ";
                } else if (ast.name !== "") {
                    commentPrefix = "var " + ast.name + " = ";
                }
                
                this._code(this._builderVar + ".Bind(")._comment(commentPrefix + this._binder + "(")._generateRaw(ast.expression)._comment(");")._newLine(", function (" + ast.name + ") {");
                this._codeIndentLevel(1);
                
                if (ast.isReturn) {
                    this._codeIndents()
                        ._newLine("return " + this._builderVar + ".Return(" + ast.name + ");");
                } else {
                    if (ast.assignee) {
                        this._bothIndents()
                            ._generateRaw(ast.assignee)._bothLine(" = " + ast.name + ";");
                    }
                    
                    this._generateWindStatements(ast.following);
                }
                this._codeIndentLevel(-1);
                
                this._codeIndents()
                    ._code("})");
            },
            
            Normal: function (ast) {
                this._code(this._builderVar + ".Normal()");
            },
            
            Raw: function (ast) {
                this._generateRaw(ast.statement);
            },
            
            For: function (ast) {
                if (ast.test) {
                    this._codeLine(this._builderVar + ".For(function () {")
                        ._commentLine("for (");
                    this._codeIndentLevel(1);
                    
                    this._bothIndents()
                        ._code("return ")
                        ._comment("; ")
                            ._generateRaw(ast.test)
                                ._newLine(";");
                    this._codeIndentLevel(-1);
                    
                    this._bothIndents()._code("}, ");
                } else {
                    this._code(this._builderVar + ".For(null, ")
                        ._comment("for (; ");
                }
                
                if (ast.update) {
                    this._newLine("function () {");
                    this._codeIndentLevel(1);
                    
                    this._bothIndents()
                        ._comment("; ")
                            ._generateRaw(ast.update)
                                ._codeLine(";")
                                ._commentLine(") {");
                    this._codeIndentLevel(-1);
                    
                    this._codeIndents()._newLine("},");
                } else {
                    this._codeLine("null,")._commentLine("; ) {");
                }
                this._bothIndentLevel(1);
                
                this._bothIndents()._generateWind(ast.body)._newLine();
                this._bothIndentLevel(-1);
                
                this._bothIndents()._code(")")._comment("}");
            },
            
            If: function (ast) {
                this._both("if (")._generateRaw(ast.test)._bothLine(") {");
                this._bothIndentLevel(1);
                
                this._generateWindStatements(ast.consequent);
                this._bothIndentLevel(-1);
                
                this._bothIndents()._both("}");
            },
            
            Combine: function (ast) {
                this._newLine(this._builderVar + ".Combine(");
                this._codeIndentLevel(1);

                this._bothIndents()._generateWind(ast.first)._newLine(",");
                this._bothIndents()._generateWind(ast.second)._newLine();
                this._codeIndentLevel(-1);

                this._codeIndents()._code(")");
            }
        },
        
        /* Raw */
        
        _generateRawStatements: function (statements) {
            for (var i = 0; i < statements.length; i++) {
                this._generateRaw(statements[i]);
            }

            return this;
        },
        
        _generateRawBody: function (bodyAst) {
            if (bodyAst.type === "BlockStatement") {
                this._bothLine(" {");
                this._bothIndentLevel(1);
                
                this._generateRawStatements(bodyAst.body);
                this._bothIndentLevel(-1);
                
                this._bothIndents()._bothLine("}");
            } else {
                this._bothLine();
                this._bothIndentLevel(1);
                
                this._generateRaw(bodyAst);
                this._bothIndentLevel(-1);
            }
            
            return this;
        },
        
        _generateRawElements: function (elements) {
            for (var i = 0; i < elements.length; i++) {
                this._generateRaw(elements[i]);
                if (i < elements.length - 1) this._both(", ");
            }
            
            return this;
        },
        
        _generateRaw: function (ast) {
            var generator = this._rawGenerators[ast.type];
            if (!generator) {
                debugger;
                throw new Error("Unsupported type: " + ast.type);
            }
            
            generator.apply(this, arguments);
            return this;
        },
        
        _rawGenerators: {
            CallExpression: function (ast) {
                this._generateRaw(ast.callee)._both("(")._generateRawElements(ast.arguments)._both(")");
            },
            
            MemberExpression: function (ast) {
                this._generateRaw(ast.object);
                
                if (ast.computed) {
                    this._both("[");
                } else {
                    this._both(".");
                }
                
                this._generateRaw(ast.property);
                
                if (ast.computed) {
                    this._both("]");
                }
            },
            
            Identifier: function (ast) {
                this._recordPosition(ast);
                this._both(ast.name);
            },
            
            IfStatement: function (ast) {
                this._bothIndents()._both("if (")._generateRaw(ast.test)._both(")");
                
                var consequent = ast.consequent;
                var alternate = ast.alternate;
                
                if (consequent.type === "BlockStatement") {
                    this._bothLine(" {");
                    this._bothIndentLevel(1);
                    
                    this._generateRawStatements(consequent.body);
                    this._bothIndentLevel(-1);
                    
                    this._bothIndents()._both("}");
                    
                    if (!alternate) {
                        this._bothLine();
                        return;
                    }
                    
                    throw new Error("Not supported yet");
                } else {
                    this._bothLine();
                    this._bothIndentLevel(1);
                    
                    this._generateRaw(consequent);
                    this._bothIndentLevel(-1);
                    
                    if (!alternate) {
                        return;
                    }
                    
                    throw new Error("Not supported yet");
                }
            },
            
            BlockStatement: function (ast) {
                this._bothIndents()._bothLine("{");
                this._bothIndentLevel(1);
                
                this._generateRawStatements(ast.body)
                this._bothIndentLevel(-1);
                
                this._bothIndents()._bothLine("}");
            },
            
            ReturnStatement: function (ast) {
                if (this._pos.inFunction) {
                    this._bothIndents()._both("return");
                    
                    if (ast.argument) {
                        this._both(" ")._generateRaw(ast.argument);
                    }
                        
                    this._bothLine(";");
                } else {
                    this._bothIndents()._comment("return")._code("return " + this._builderVar + ".Return(");

                    if (ast.argument) {
                        this._comment(" ")._generateRaw(ast.argument);
                    }
                    
                    this._commentLine(";")._codeLine(");");
                }
            },
            
            VariableDeclaration: function (ast, asExpr) {
                if (!asExpr) this._bothIndents();
                this._both(ast.kind)._both(" ");
                
                var decls = ast.declarations;
                for (var i = 0; i < decls.length; i++) {
                    var d = decls[i];
                    this._both(d.id.name + " = ")._generateRaw(d.init);
                    
                    if (i < decls.length - 1) this._both(", ");
                }
                
                if (!asExpr) this._bothLine(";");
            },
            
            NewExpression: function (ast) {
                this._both("new ")._generateRaw(ast.callee)._both("(")._generateRawElements(ast.arguments)._both(")");
            },
            
            Literal: function (ast) {
                this._both(stringify(ast.value));
            },
            
            ArrayExpression: function (ast) {
                if (ast.elements.length > 0) {
                    this._both("[ ")._generateRawElements(ast.elements)._both(" ]");
                } else {
                    this._both("[]");
                }
            },
            
            ForStatement: function (ast) {
                this._bothIndents()._both("for (");
                
                if (ast.init) {
                    this._generateRaw(ast.init, true);
                }
                this._both("; ");
                
                if (ast.test) {
                    this._generateRaw(ast.test);
                }
                this._both("; ");
                
                if (ast.update) {
                    this._generateRaw(ast.update);
                }
                
                this._both(")");
                
                this._generateRawBody(ast.body);
            },
            
            BinaryExpression: function (ast) {
                var left = ast.left, right = ast.right;
                
                if (getPrecedence(ast) < getPrecedence(left)) {
                    this._both("(")._generateRaw(left)._both(")");
                } else {
                    this._generateRaw(left);
                }
                
                this._both(" " + ast.operator + " ");
                
                if (getPrecedence(ast) <= getPrecedence(right)) {
                    this._both("(")._generateRaw(right)._both(")");
                } else {
                    this._generateRaw(right);
                }
            },
            
            UpdateExpression: function (ast) {
                if (ast.prefix) {
                    this._both(ast.operator);
                }
                
                this._generateRaw(ast.argument);
                
                if (!ast.prefix) {
                    this._both(ast.operator);
                }
            },
            
            ExpressionStatement: function (ast) {
                this._bothIndents()._generateRaw(ast.expression)._bothLine(";");
            },
            
            ObjectExpression: function (ast) {
                var properties = ast.properties;
                
                if (properties.length > 0) {
                    this._bothLine("{");
                    this._bothIndentLevel(1);
                
                    for (var i = 0; i < properties.length; i++) {
                        var prop = properties[i];
                        this._bothIndents()._both(stringify(prop.key.name) + ": ")._generateRaw(prop.value);
                        
                        if (i < properties.length - 1) {
                            this._both(",");
                        }
                        
                        this._bothLine();
                    }
                    this._bothIndentLevel(-1);
                    
                    this._bothIndents()._both("}");
                }
            },
            
            UnaryExpression: function (ast) {
                var operator = ast.operator;
                var arg = ast.argument;
                
                this._both(operator);
                if (operator.length > 2) { // + - !
                    this._both(" ");
                }
                
                if (getPrecedence(ast) < getPrecedence(arg)) {
                    this._both("(")._generateRaw(arg)._both(")");
                } else {
                    this._generateRaw(arg);
                }
            }
        }
    };
    
    var Fn = Function, global = Fn('return this')();
    
    var merge = function (commentLines, codeLines, sourceMap) {
        var length = commentLines.length;
        
        var maxShift = 0;
        
        for (var i = 0; i < length; i++) {
            var matches = codeLines[i].match(" +");
            var spaceLength = matches ? matches[0].length : 0;
            
            var shift = commentLines[i].length - spaceLength + 10;
            if (shift > maxShift) {
                maxShift = shift;
            }
        }
        
        if (sourceMap) {
            sourceMap.setColumnShift(maxShift);
        }
        
        var shiftBuffer = new Array(maxShift);
        for (var i = 0; i < maxShift; i++) {
            shiftBuffer[i] = " ";
        }
        
        var shiftSpaces = shiftBuffer.join("");

        var buffer = [];
        for (var i = 0; i < length; i++) {
            var comment = commentLines[i]; 
            if (comment.replace(/ +/g, "").length > 0) {
                comment = "/* " + comment + " */   ";
            }
            
            var code = shiftSpaces + codeLines[i];
            
            buffer.push(comment);
            buffer.push(code.substring(comment.length));
            
            if (i != length - 1) {
                buffer.push("\n");
            }
        }
        
        return buffer.join("");
    }
    
    var uniqueNames = {};

    var getUniqueName = function (name) {
        if (!name) {
            name = "anonymous";
        }
        
        if (!uniqueNames[name]) {
            uniqueNames[name] = true;
            return name;
        }
        
        for (var i = 0; ; i++) {
            var testName = name + "_" + i;
            if (!uniqueNames[testName]) {
                uniqueNames[testName] = true;
                return testName;
            }
        }
    };
    
    var splitLines = function (lines) {
        return lines.replace(/\r\n/g, "\n").split("\n");
    }
    
    var matchAll = function (regex, str) {
        var matches = [];
        
        var match;
        while (match = regex.exec(str)) {
            matches.push(match);
        }
        
        return matches;
    };
    
    var normalizeLineBreaks = function (code) {
        return code.replace(/\r\n/g, "\n");
    };
    
    var numberOfLineBreaks = function (code) {
        var count = 0;
        for (var i = 0; i < code.length; i++) {
            if (code[i] === "\n") count++;
        }
        
        return count;
    };
    
    var createSourceMap = function (code) {
        if (typeof process === "undefined") return;
        if (typeof process.execPath !== "string") return;
        
        var stack = new Error().stack;
        var matches = matchAll(/at ([^(]+\((.*):\d+:\d+\)$|(.*):\d+:\d+)$/gm, stack);
        var filenames = _.map(matches, function (m) { return m[2] || m[3]; });
        
        var fs = require("fs");
        
        return _.each(filenames, function (f) {
            if (f === __filename) return;
            if (f[0] != "/") return;
            
            try {
                var content = normalizeLineBreaks(fs.readFileSync(f, "utf8"));
                var index = content.indexOf(code);
                if (index < 0) return;
                
                var codeBefore = content.substring(0, index);
                var lineShift = numberOfLineBreaks(codeBefore);
                
                return new SourceMap(f, lineShift);
            } catch (ex) {
                return;
            }
        });
    };
    
    var allSourceMaps = {};
    
    var rebuildStack = function (stack) {
        console.log(JSON.stringify(allSourceMaps, null, 2));
    
        return stack.replace(/at eval \((.*)\)$/mg, function (s) {
            var match = /\((.*):(\d+):(\d+)\)/.exec(s);
            var url = match[1];
            var line = parseInt(match[2], 10);
            // V8 stack use 1-based column, but 
            // we use 0-based during calculation
            var column = parseInt(match[3], 10) - 1; 
            
            var sourceMap = allSourceMaps[url];
            if (!sourceMap) return s;
            
            var pos = sourceMap.getSourcePosition(line, column);
            if (!pos) return s;
            
            var posInfo = sourceMap.file + ":" + pos.line + ":" + (pos.column + 1);
            
            return "at eval (" + url + ":" + line + ":" + column + " => " + posInfo + ")"
        });
    }
    
    var compile = function (builderName, fn) {
        var funcCode = normalizeLineBreaks(fn.toString());
        var esprima = (typeof require === "function") ? require("esprima") : global.esprima;
        var inputAst = esprima.parse("(" + funcCode + ")", { loc: true });
        var windAst = (new WindAstGenerator(builderName)).generate(inputAst.body[0].expression);
        
        console.log(windAst);
        
        var uniqueName = getUniqueName(windAst.name);
        var sourceUrl = "wind/" + uniqueName + ".js";
        
        var sourceMap = createSourceMap(funcCode) || new SourceMap(sourceUrl + " (original)", 0);
        allSourceMaps[sourceUrl] = sourceMap;
        
        var codeWriter = new CodeWriter();
        var commentWriter = new CodeWriter();
        (new CodeGenerator(builderName, codeWriter, commentWriter, sourceMap)).generate(windAst);
        
        var newCode = merge(commentWriter.lines, codeWriter.lines, sourceMap);
        newCode += "\n//@ sourceURL=" + sourceUrl;
        
        console.log(newCode);
        
        return newCode;
    };
    
    // CommonJS
    var isCommonJS = !!(typeof require === "function" && typeof module !== "undefined" && module.exports);

    var defineModule = function () {
        _ = Wind._;

        Wind.define({
            name: "compiler2",
            version: "0.7.1",
            require: isCommonJS && require,
            dependencies: { core: "~0.7.0" },
            init: function () {
                Wind.compile = compile;
                Wind.rebuildStack = rebuildStack;
            }
        });
    };
    
    if (isCommonJS) {
        try {
            Wind = require("./wind-core");
        } catch (ex) {
            Wind = require("wind-core");
        }
        
        defineModule();
    } else {
        if (!global.Wind) {
            throw new Error('Missing the root object, please load "wind" component first.');
        }
        
        Wind = global.Wind;
        defineModule();
    }
})();