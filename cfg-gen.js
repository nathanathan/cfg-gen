/*
Possibly useful notes to self:
http://www.geekymonkey.com/programming/jquery/TextFill/example.htm

Not sure the best way to put the nodes into a database because of the prototype issue.

Rename options to select?
Options sounds like it could mean configuration of the interface itself.

Use this for tutorial?
http://pushly.github.com/bootstrap-tour/index.html
*/

//For halting script exec
$(window).keydown(function(e) { if (e.keyCode == 123) debugger; });

var gensym = (function() {
    var uniqueSymbol = 1;
    function gensym(){
        uniqueSymbol++;
        return '-'+uniqueSymbol+'-';
    }
    return gensym;
}());

//This generates uids for the objects created:
//modified from the version here to support Object.create():
//see: http://stackoverflow.com/questions/1997661/unique-object-identifier-in-javascript
(function() {
    var id_counter = 1;
    Object.defineProperty(Object.prototype, "__uid", {
        writable: true
    });
    Object.defineProperty(Object.prototype, "uid", {
        get: function() {
            if (!this.hasOwnProperty("__uid")){
                this.__uid = id_counter++;
            }
            return this.__uid;
        }
    });
}());
function inheritFrom(a,b){
    //Using ECMAScript5's Object.create instead of classical jso pattern
    //see: http://ejohn.org/blog/ecmascript-5-objects-and-properties/
    //return $.extend(Object.create(a), b);
    var p = Object.create(a);
    $.each(b, function(k,v){
        p[k] = v;
    });
    return p;
}
var BaseNode = {
    symbol : null,//TODO: change to name?
    value : null,
    /**
     * Create a prototype of this object, with properties in the given object overridden.
     **/
    create : function(overrides){
        if(!overrides){
            overrides = {};
        }
        return $.extend(Object.create(this), overrides);
    },
    /**
     * Generates a string based on the value of this CFG node.
     **/
    generateString : function(){
        if(this.value && BaseNode.isPrototypeOf(this.value)){
            return this.value.generateString();
        }
        return this.value;
    },
    //getParseWeight : function(){},
    /**
     * Does top down parsing of a string, returning a newly created instance
     * of the node with the value set if parsing is successful, or false for failure.
     **/
    parseString : function(string){
        if(string === this.symbol){
            return this.create({value:this.symbol});
        }
        return false;
    },
    /**
     * Creates a jQuery DOM object representing this node.
     **/
    renderHTML : function(){
        if(this.value instanceof Object && 'renderHTML' in this.value){
            //hooray it quacks
            return this.value.renderHTML();
        } else {
            return $('<span>').html(this.value);
        }
    }
};
var GroupNode = inheritFrom( BaseNode, {
    items : [],
    create : function(overrides){
        if(!overrides){
            overrides = {};
        }
        var items_copy = [];
        $.each(this.items, function(idx, item){
            items_copy[idx] = item.create();
        });
        return $.extend(Object.create(this), {items:items_copy}, overrides);
    },
    generateString : function(){
        var string = "";
        $.each(this.items, function(idx, item){
            string += item.generateString();
        });
        return string;
    },
    parseString : function(string){
        if(this.items.length === 0){
            return string === '' ? this.create() : false;
        }
        var currentItem = this.items[0];
        //This could be more efficient
        var remainingItemGroup = this.create({items:this.items.slice(1)});
        
        for(var i = 0; i <= string.length; i++){
            var leftParse = currentItem.parseString(string.substr(0, i));
            if(leftParse){
                var rightParse = remainingItemGroup.parseString(string.substr(i));
                if(rightParse){
                    console.log(this);
                    console.log("parsed");
                    console.log(string);
                    return this.create({items:[leftParse].concat(rightParse.items)});
                }
            }
        }
        return false;
    },
    renderHTML : function(){
        var $container = $('<div class="grammarnode group">').addClass('group');
        $.each(this.items, function(idx, item){
            $container.append(item.renderHTML());
        });
        //For style
        /*
        $container.resize(function(){
            var max_el_height = 0;
            $container.children().each(function(idx, $el){
                var el_height = $(this).css('height');
                if(el_height > max_el_height){
                    max_el_height = el_height;
                }
            });
            alert('hi');
            $container.children().each(function(idx, $el){
                $(this).css('height', max_el_height);
            });
        });
        */
        return $container;
    }
});
//NT = non-terminal
var NonTerminalNode = inheritFrom( BaseNode, {
    options : null,
    create : function(overrides){
        if(!overrides){
            overrides = {};
        }
        if(this.value && BaseNode.isPrototypeOf(this.value)){
            //Copy the value
            return $.extend(Object.create(this), {value:this.value.create()}, overrides);
        }
        return $.extend(Object.create(this), overrides);
    },
    parseString : function(string){
        for(var i = 0; i < this.options.length; i++){
            var optionParse = this.options[i].parseString(string);
            if(optionParse){
                return this.create({value:optionParse});
            }
        }
        return false;
    },
    setValue : function(val){
        var NT = this;
        NT.value = val;
        $('.uid'+NT.uid).each(function(){
            $(this).replaceWith(NT.renderHTML());
        });
    },
    instances : [],//Only override this if you know what you're doing.
    getSuggestions : function(){
    },
    $menu : null,
    renderMenuHTML : function(){
        var NT = this;
        function renderItems(items){
            var $list = $('<ul>').addClass('nav').addClass('nav-list');
            $.each(items, function(i, item){
                //I create prototypes of the options in the menu
                //so that it is possible to mess around with them while in the menu.
                //Watch out for group nodes and arrays, they make this stuff complicated.
                var itemPrototype = item.create();
                //Put it in selectable row
                var $row = $('<li class="menuitem">');
                var $rowBtn = $('<button class="btn option-button">');
                /*
                $rowBtn.click(function(){
                    NT.$menu.detach();
                    NT.$menu = null;
                    NT.setValue(itemPrototype);
                });
                */
                //This does "superselection" where parents are selected while mouse is held down
                $rowBtn.bind('mousedown touchstart', function mousedownHandler() {
                    $(this).unbind('mousedown touchstart', mousedownHandler);
                    var $rowBtn = $(this);//just to be sure $rowBtn is pointing at the right thing
                    var $parentRowBtn = $rowBtn.closest('.grammarnode').closest('.menuitem').children('.option-button');

                    var mouseupHandler = function(event){
                        $rowBtn.unbind('mouseup touchstop', mouseupHandler);
                        clearTimeout(mousedownTimer);
                        $rowBtn.bind('mousedown touchstart', mousedownHandler);
                        
                        $rowBtn.unbind('mouseleave touchcancel touchmove', mouseleaveHandler);
                        
                        NT.$menu.detach();
                        NT.$menu = null;
                        NT.setValue(itemPrototype);
                        $parentRowBtn.mouseup();
                    };
                    $rowBtn.bind('mouseup touchend', mouseupHandler);
                    var mouseleaveHandler = function(event){
                        $rowBtn.unbind('mouseup touchend', mouseleaveHandler);
                        //$rowBtn.unbind(event);
                        clearTimeout(mousedownTimer);
                        $rowBtn.bind('mousedown touchstart', mousedownHandler);
                        
                        $rowBtn.unbind('mouseup touchend', mouseupHandler);
                        
                        $rowBtn.removeClass('btn-warning');
                        $parentRowBtn.mouseleave();
                    };
                    $rowBtn.bind('mouseleave touchcancel touchmove', mouseleaveHandler);
                    $rowBtn.addClass('btn-warning');
                    if($parentRowBtn.length > 0){
                        var mousedownTimer = setTimeout(function(){
                            $parentRowBtn.mousedown();
                        }, 650);
                    }
                });
                
                $row.append($rowBtn);
                $row.append(itemPrototype.renderHTML());
                $list.append($row);
            });
            return $list;
        }
        var $menu = $('<div>').addClass('well').addClass('menu');
        var $head = $('<div>').addClass('menu-header');
        var $closeBtn = $('<button class="close">×</button>');
        $closeBtn.click(function(){
            NT.$menu.remove();
            NT.$menu = null;
            //TODO: This breaks border highlighting which I want to do with css.
        });
        $head.append($closeBtn);
        $head.append($('<div class="label label-info symbol">').text(NT.symbol));
        $menu.append($head);
        $menu.append($('<h5>').text("base options"));
        $menu.append(renderItems(NT.options));
        $menu.append($('<h5>').text("instances"));
        $menu.append(renderItems(NT.value ? [NT.value] : []));
        return $menu;
    },
    renderHTML : function(){
        var NT = this;
        var $container = $('<div>').addClass('options');
        $container.addClass('uid'+NT.uid);
        if(NT.value){
            $container.append(NT.value.renderHTML().addClass('selection').addClass('grammarnode'));
        } else {
            var $symbol = $('<div class="label label-inverse symbol">');
            $symbol.text(NT.symbol);
            $container.append($symbol.clone());
        }
        
        var $btnGroup = $('<div class="btn-group">');
        var $menuBtn = $('<button class="btn">').text('options');
        var default_border_color = null;
        $menuBtn.click(function(){
            if(NT.$menu){
                NT.$menu.remove();
                NT.$menu = null;
            } else {
                NT.$menu = NT.renderMenuHTML();
                $container.append(NT.$menu);
            }
            if(!default_border_color){
                default_border_color = $container.css('border-left-color');
            }
            if($container.css('border-left-color') !== 'rgb(255, 200, 200)'){
                $container.css('border-color', 'rgb(255,200,200)');
            } else {
                $container.css('border-color', default_border_color);
            }
        });
        $btnGroup.append($menuBtn);
        $btnGroup.append($('<button class="btn dropdown-toggle" data-toggle="dropdown"><span class="caret"></span></button>'));
        var $otherOptions = $('<ul class="dropdown-menu">');
        $otherOptions.append($('<li><a>Inspect Object</a></li>'));
        var $genStringBtn = $('<a>Generate String</a>');
        $genStringBtn.click(function(){
            alert(NT.generateString());
        });
        $otherOptions.append($('<li>').append($genStringBtn));
        var $parseStringBtn = $('<a>Parse String</a>');
        $parseStringBtn.click(function(){
            var parse = NT.parseString(prompt());
            if(parse){
                //console.log(parse.value);
                NT.setValue(parse.value);
            } else {
                alert("could not parse string");
            }
        });
        $otherOptions.append($('<li>').append($parseStringBtn));
        
        $btnGroup.append($otherOptions);
        $container.append($btnGroup);
        $container.addClass('selection').addClass('grammarnode');
        if(NT.$menu){
            $container.append(NT.$menu);
        }
        return $container;
    }
});
function buildCFGraph(cfg, symbolObject){
    if(typeof symbolObject === "string"){
        symbolObject = { symbol : symbolObject };
    }
    if(BaseNode.isPrototypeOf(symbolObject)){
        //we've already processed this one.
        return symbolObject;
    }
    if($.isArray(symbolObject)){
        $.each(symbolObject, function(idx, item){
            symbolObject[idx] = BaseNode.create();//placeholder to stop infinite looping
            symbolObject[idx] = buildCFGraph(cfg, item);
        });
        return inheritFrom(GroupNode, { items : symbolObject });
    }
    if(!('symbol' in symbolObject)){
        symbolObject.symbol = 'anonymous object';
    }
    if(!symbolObject.options){
        if(symbolObject.symbol in cfg){
            var cfgValue = cfg[symbolObject.symbol];
            if($.isArray(cfgValue)){
                symbolObject.options = cfgValue;
            } else {
                return inheritFrom(BaseNode, $.extend({}, cfgValue, symbolObject));
            }
        } else {
            symbolObject.value = symbolObject.symbol;
            return inheritFrom(BaseNode, symbolObject);
        }
    }
    $.each(symbolObject.options, function(idx, option){
        symbolObject.options[idx] = BaseNode.create();//placeholder to stop infinite looping
        symbolObject.options[idx] = buildCFGraph(cfg, option);
    });
    return inheritFrom(NonTerminalNode, symbolObject);
}
