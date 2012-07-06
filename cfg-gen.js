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
    create : function(){
        return Object.create(this);
    },
    symbol : null,//change to name
    value : null,
    renderHTML : function(){
        if(this.value instanceof Object && 'renderHTML' in this.value){
            //hooray it quacks
            return this.value.renderHTML();
        } else {
            return $('<span>').html(this.value);
        }
    },
    generateString : function(){
        if(this.value && BaseNode.isPrototypeOf(this.value)){
            return this.value.generateString();
        }
        return this.value;
    }
};
var GroupNode = inheritFrom( BaseNode, {
    create : function(){
        var prototype =  Object.create(this);
        prototype.items = [];
        $.each(this.items, function(idx, item){
            prototype.items[idx] = item.create();
        });
        return prototype;
    },
    generateString : function(){
        var string = "";
        $.each(this.items, function(idx, item){
            string += item.generateString();
        });
        return string;
    },
    items : [],
    renderHTML : function(){
        var $container = $('<div>').addClass('group');
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
    instances : [],//Only override this if you know what you're doing.
    getSuggestions : function(){
    },
    create : function(){
        var prototype =  Object.create(this);
        if(this.value && BaseNode.isPrototypeOf(this.value)){
            prototype.value = this.value.create();
        }
        return prototype;
    },
    options : null,
    setValue : function(val){
        var NT = this;
        NT.value = val;
        $('.uid'+NT.uid).each(function(){
            $(this).replaceWith(NT.renderHTML());
        });
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
                var $row = $('<li>');
                var $rowBtn = $('<input type="radio">').addClass('option-button');
                /*
                $rowBtn.click(function(){
                    NT.$menu.detach();
                    NT.$menu = null;
                    NT.setValue(itemPrototype);
                });
                */
                //This does "superselection" where parents are selected while mouse is held down
                $rowBtn.bind('mousedown', function mousedownHandler() {
                    var $rowBtn = $(this);//just to be sure $rowBtn is pointing at the right thing
                    $rowBtn.attr('checked', true);
                    $rowBtn.unbind('mousedown', mousedownHandler);
                    var $parentRowBtn = $rowBtn.closest('.selection').closest('li').children('.option-button');
                    if($parentRowBtn.length > 0){
                        var mousedownTimer = setTimeout(function(){
                            $parentRowBtn.mousedown();
                        }, 650);
                    }
                    var mouseupHandler = function(event){
                        $rowBtn.unbind(event);
                        clearTimeout(mousedownTimer);
                        $rowBtn.bind('mousedown', mousedownHandler);
                        
                        $rowBtn.unbind('mouseleave', mouseleaveHandler);
                        
                        NT.$menu.detach();
                        NT.$menu = null;
                        NT.setValue(itemPrototype);
                        $parentRowBtn.mouseup();
                    };
                    $rowBtn.bind('mouseup', mouseupHandler);
                    var mouseleaveHandler = function(event){
                        $rowBtn.unbind(event);
                        clearTimeout(mousedownTimer);
                        $rowBtn.bind('mousedown', mousedownHandler);
                        
                        $rowBtn.unbind('mouseup', mouseupHandler);
                        
                        $(this).attr('checked', false);
                        $parentRowBtn.mouseleave();
                    };
                    $rowBtn.bind('mouseleave', mouseleaveHandler);
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
            $container.append(BaseNode.renderHTML.call(this).addClass('selection'));
        } else {
            var $symbol = $('<div class="label label-inverse symbol">');
            $symbol.text(NT.symbol);
            $container.append($symbol.clone());
        }
        
        var $btnGroup = $('<div class="btn-group">');
        var $menuBtn = $('<button class="btn btn-mini">').text('options');
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
        $btnGroup.append($('<button class="btn btn-mini dropdown-toggle" data-toggle="dropdown"><span class="caret"></span></button>'));
        var $otherOptions = $('<ul class="dropdown-menu">');
        $otherOptions.append($('<li><a>Inspect Object</a></li>'));
        var $genStringBtn = $('<a>GenerateString</a>');
        $genStringBtn.click(function(){
            alert(NT.generateString());
        });
        $otherOptions.append($('<li>').append($genStringBtn));
        
        $btnGroup.append($otherOptions);
        $container.append($btnGroup);
        $container.addClass('selection');
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
