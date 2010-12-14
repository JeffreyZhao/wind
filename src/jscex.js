var Jscex = {};
Jscex.compile = function(builderName, func) {
    var funcCode = func.toString();
    
    var code = "var f = " + funcCode + ";";
    var ast = Narcissus.parse(code, "temp", 1);
    var funcAst = ast[0][0].initializer;

    var compiler = new Jscex.ScriptCompiler(builderName);
    var compiledCode = compiler.compile(funcAst);
    
    if (typeof(console) != "undifined" && console.log) {
        console.log(funcCode + "\n\n>>>\n\n" + compiledCode);
    }
    
    return "(function() {\n\nreturn " + compiledCode + "\n\n})();"
}

Jscex.StringBuilder = function() {
    this._parts = [];
}
Jscex.StringBuilder.prototype.append = function(s) {
    this._parts.push(s);
    return this;
}
Jscex.StringBuilder.prototype.appendLine = function(s) {
    this._parts.push(s);
    this._parts.push("\n");
    return this;
}
Jscex.StringBuilder.prototype.toString = function() {
    return this._parts.join("");
}

Jscex.ScriptCompiler = function(builderName) {
    var binder = eval(builderName).binder;

    this.compile = function(node) {
        var sb = this._sb = new Jscex.StringBuilder();

        sb.append("function(").append(node.params.join(", ")).appendLine(") {");
        this._indentLevel++;

        this._appendIndents();
        sb.append("return ").append(builderName).appendLine(".Delay(function() {");

        this._indentLevel++;
        this.visitStatements(node.body);
        this._indentLevel--;

        this._appendIndents();
        sb.appendLine("});");
        this._indentLevel--;

        sb.appendLine("};");

        return sb.toString();
    }

    this._indentLevel = 0;
    this._appendIndents = function() {
        for (var i = 0; i < this._indentLevel; i++) {
            this._sb.append("    ");
        }
    }

    this.visit = function(node) {
        var token = this._getToken(node);
        if (token == "while") {
            this.visitWhile(node);
        } else if (token == ";") {
            this.visitSemicolon(node);
        } else if (token == ".") {
            this.visitDot(node);
        } else if (token == "CALL") {
            this.visitCall(node);
        } else if (token == "IDENTIFIER") {
            this.visitIdentifier(node);
        } else if (token == "STRING") {
            this.visitString(node);
        } else if (token == "new") {
            this.visitNew(node);
        } else if (token == "NEW_WITH_ARGS") {
            this.visitNewWithArgs(node);
        } else if (token == "NUMBER") {
            this.visitNumber(node);
        } else if (token == "var") {
            this.visitVar(node);
        } else if (token == "+" || token == "-" || token == "*" || token == "/" || token == "%") {
            this.visitBinaryOp(node);
        } else if (token == "return") {
            this.visitReturn(node);
        } else if (token == "OBJECT_INIT") {
            this.visitObjectInit(node);
        } else if (token == "PROPERTY_INIT") {
            this.visitPropertyInit(node);
        } else if (token == "GROUP") {
            this.visitGroup(node);
        } else if (token == "ARRAY_INIT") {
            this.visitArrayInit(node);
        } else if (token == "debugger") {
            this.visitDebugger(node);
        } else if (token == "INDEX") {
            this.visitIndex(node);
        } else if (token == "for") {
            this.visitFor(node);
        } else if (token == "if") {
            this.visitIf(node);
        } else if (token == "function") {
            this.visitFunction(node);
        } else {
            alert("unrecognized node type: " + token);
            debugger;
        }
    }

    this.visitFunction = function(node) {
        this._sb.append(node.getSource());
    }
    
    this.visitDebugger = function(node) {
        this._appendIndents();
        this._sb.append(node.getSource()).appendLine(";");
    }
    
    this.visitIndex = function(node) {
        this._sb.append(node.getSource());
    }
    
    this.visitGroup = function(node) {
        this._sb.append(node.getSource());
    }
    
    this.visitObjectInit = function(node) {
        var sb = this._sb;
        
        sb.append("{");
        if (node.length > 0) {
            this.visit(node[0]);
            for (var i = 1; i < node.length; i++) {
                sb.append(", ");
                this.visit(node[i]);
            }
        }
        sb.append("}");
    }
    
    this.visitPropertyInit = function(node) {
        this.visit(node[0]);
        this._sb.append(": ");
        this.visit(node[1]);
    };

    this.visitArrayInit = function(node) {
        var sb = this._sb;

        sb.append("[");
        if (node.length > 0) {
            this.visit(node[0]);
            for (var i = 1; i < node.length; i++) {
                sb.append(", ");
                this.visit(node[i]);
            }
        }
        sb.append("]");
    };
    
    this.visitBinaryOp = function(node) {
        this._sb.append(node.getSource());
    }

    this.visitReturn = function(node) {
        var sb = this._sb;

        this._appendIndents();
        sb.append("return ").append(builderName).append(".Return(");
        this.visit(node.expression);
        sb.appendLine(");");
    }

    this.visitPlus = function(node) {
        this.visit(node[0]);
        this._sb.append(" + ");
        this.visit(node[1]);
    }

    this.visitVar = function(node) {
        var sb = this._sb;

        this._appendIndents();
        sb.append("var ");
        this.visit(node[0]);
        sb.appendLine(";");
    }

    this.visitNumber = function(node) {
        this._sb.append(node.getSource());
    }

    this.visitNewWithArgs = function(node) {
        this._sb.append(node.getSource());
    }

    this.visitNew = function(node) {
        this._sb.append(node.getSource());
    }

    this.visitString = function(node) {
        this._sb.append(node.getSource());
    }

    this.visitList = function(node) {
        var items = node;
        if (items.length > 0) {
            this.visit(items[0]);
            for (var i = 1; i < items.length; i++) {
                this._sb.append(", ");
                this.visit(items[i]);
            }
        }
    }

    this.visitIdentifier = function(node) {
        var sb = this._sb;

        sb.append(node.value);
        if (node.initializer) {
            sb.append(" = ");
            this.visit(node.initializer);
        }
    }

    this.visitDot = function(node) {
        this._sb.append(node.getSource());
    }

    this.visitCall = function(node) {
        this._sb.append(node.getSource());
    }

    this.visitAssign = function(node) {
        this.visit(node[0]);
        this._sb.append(" = ");
        this.visit(node[1]);
    }

    this.visitSemicolon = function(node) {
        this._appendIndents();
        this._sb.append(node.getSource()).appendLine(";");
    }

    this._getBindInfo = function(node) {
        var token = this._getToken(node);
        if (token == ";") {
            var expr = node.expression;
            if (this._getToken(expr) == "CALL") {
                var callee = expr[0];
                if (this._getToken(callee) == "IDENTIFIER" && callee.value == binder) {
                    return {
                        expression: expr[1][0],
                        argName: ""
                    };
                }
            }
        } else if (token == "var") {
            var idExpr = node[0];
            var expr = idExpr.initializer;
            if (expr && this._getToken(expr) == "CALL") {
                var callee = expr[0];
                if (this._getToken(callee) == "IDENTIFIER" && callee.value == binder) {
                    return {
                        expression: expr[1][0],
                        argName: idExpr.value
                    };
                }
            }
        } else if (token == "return") {
            // debugger;
            var expr = node.expression;
            if (this._getToken(expr) == "CALL") {
                var callee = expr[0];
                if (this._getToken(callee) == "IDENTIFIER" && callee.value == binder) {
                    return {
                        expression: expr[1][0],
                        argName: "$$__$$__",
                        isReturn: true
                    };
                }
            }
        }
        
        return null;
    }

    this.visitStatements = function(nodeArray, index, returnArgName) {
        if (arguments.length <= 1) {
            index = 0;
        }

        if (arguments.length <= 2) {
            returnArgName = "";
        }

        var sb = this._sb;

        if (index >= nodeArray.length) {
            this._appendIndents();
            sb.append("return ").append(builderName).append(".Return(").append(returnArgName).appendLine(");");
            return;
        }

        var stmt = nodeArray[index];
        var bindInfo = this._getBindInfo(stmt);

        if (!bindInfo) {
            var token = this._getToken(stmt);
            if (token == "return") {
                this.visit(stmt);
            } else if (token == "while" || token == "try" || token == "if" || token == "for") {
                var isLast = (index == nodeArray.length - 1);
                if (isLast) {
                    this._appendIndents();
                    sb.append("return ");
                    this.visit(stmt);
                    sb.appendLine(";");
                } else {
                    this._appendIndents();
                    sb.append("return ").append(builderName).appendLine(".Combine(");
                    this._indentLevel++;
                    
                    this._appendIndents();
                    this.visit(stmt);
                    sb.appendLine(",");
                    
                    this._appendIndents();
                    sb.append(builderName).appendLine(".Delay(function() {");
                    this._indentLevel++;

                    this.visitStatements(nodeArray, index + 1);
                    this._indentLevel--;

                    this._appendIndents();
                    sb.appendLine("})");
                    this._indentLevel--;

                    this._appendIndents();
                    sb.appendLine(");");
                }
            } else {
                this.visit(stmt);
                this.visitStatements(nodeArray, index + 1);
            }

        } else {
            this._appendIndents();
            sb.append("return ").append(builderName).append(".Bind(");
            this.visit(bindInfo.expression);
            sb.append(", function(").append(bindInfo.argName).appendLine(") {");
            
            this._indentLevel++;
            if (bindInfo.isReturn) {
                this.visitStatements(nodeArray, nodeArray.length, bindInfo.argName);
            } else {
                this.visitStatements(nodeArray, index + 1);
            }
            this._indentLevel--;

            this._appendIndents();
            sb.appendLine("});");
        }
    }
    
    this.visitIf = function(node) {
        var sb = this._sb;
        
        sb.append(builderName).appendLine(".Delay(function() {");
        this._indentLevel++;
        this._appendIndents();

        while (true) {
            sb.append("if (").append(node.condition.getSource()).appendLine(") {");
            this._indentLevel++;
            
            this.visitStatements(node.thenPart);
            
            this._indentLevel--;
            this._appendIndents();
            sb.append("} else ");

            if (node.elsePart && this._getToken(node.elsePart) == "if") {
                node = node.elsePart;
            } else {
                break;
            }
        }
        
        sb.appendLine("{");
        
        this._indentLevel++;
        if (node.elsePart) {
            this.visitStatements(node.elsePart);
        } else {
            this._appendIndents();
            sb.append("return ").append(builderName).appendLine(".Return();");
        }
        
        this._indentLevel--;
        this._appendIndents();
        sb.appendLine("}");
        
        this._indentLevel--;
        this._appendIndents();
        sb.append("})");
    }

    this.visitWhile = function(node) {
        var sb = this._sb;
        
        sb.append(builderName).appendLine(".Loop(");
        this._indentLevel++;

        this._appendIndents();
        sb.append("function() { return ").append(node.condition.getSource()).appendLine("; },");

        this._appendIndents();
        sb.appendLine("null, ");

        this._appendIndents();
        sb.append(builderName).appendLine(".Delay(function() {");

        this._indentLevel++;
        this.visitStatements(node.body);
        this._indentLevel--;

        this._appendIndents();
        sb.appendLine("})");
        this._indentLevel--;

        this._appendIndents();
        sb.append(")");
        // debugger;
    }
    
    this.visitFor = function(node) {
        var sb = this._sb;
        
        sb.append(builderName).appendLine(".Delay(function() {");
        this._indentLevel++;
        
        var token = this._getToken(node.setup);
        if (token == "var") {
            this.visitVar(node.setup);
        } else {
            this._appendIndents();
            this.visit(node.setup);
            sb.appendLine(";");
        }
        
        this._appendIndents();
        sb.append("return ").append(builderName).appendLine(".Loop(");
        this._indentLevel++;
        
        this._appendIndents()
        sb.append("function() { return ").append(node.condition.getSource()).appendLine("; },");
        
        this._appendIndents();
        sb.append("function() { ").append(node.update.getSource()).appendLine("; },");
        
        this._appendIndents();
        sb.append(builderName).appendLine(".Delay(function() {");

        this._indentLevel++;
        this.visitStatements(node.body);
        this._indentLevel--;
        
        this._appendIndents();
        sb.appendLine("})");
        this._indentLevel--;
        
        this._appendIndents();
        sb.appendLine(");");
        
        this._indentLevel--;
        this._appendIndents();
        sb.append("})");
    }

    this._getToken = function(node) {
        return Narcissus.tokens[node.type];
    }
}
