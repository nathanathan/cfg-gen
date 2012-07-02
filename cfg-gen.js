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

function createDescriptor(obby){
    $.each(obby, function(key, value){
        obby[key] = {value : value, enumerable : true};
    });
    return obby;
}
function inheritFrom(a,b){
    //Using ECMAScript5's Object.create instead of classical jso pattern
    //see: http://ejohn.org/blog/ecmascript-5-objects-and-properties/
    return Object.create(a, createDescriptor(b));
}
var baseNode = {
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
    }
};
var groupNode = inheritFrom( baseNode, {
    create : function(){
        var prototype =  Object.create(this);
        prototype.items = [];
        $.each(this.items, function(idx, item){
            prototype.items[idx] = item.create();
        });
        return prototype;
    },
    items : [],
    renderHTML : function(){
        var $container = $('<div>').addClass('group');
        $.each(this.items, function(idx, item){
            $container.append(item.renderHTML());
        });
        return $container;
    }
});
//NT = non-terminal
var baseNT = inheritFrom( baseNode, {
    create : function(){
        var prototype =  Object.create(this);
        if(this.value && this.value.isPrototypeOf(baseNode)){
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
                $rowBtn.click(function(){
                    NT.setValue(itemPrototype);
                });
                $row.append($rowBtn);
                $row.append(itemPrototype.renderHTML());
                $list.append($row);
            });
            return $list;
        }
        var $menu = $('<div>').addClass('well').addClass('menu');
        $menu.append($('<div class="label label-info symbol">').text(NT.symbol));
        $menu.append($('<h5>').text("base options"));
        $menu.append(renderItems(NT.options));
        $menu.append($('<h5>').text("instances"));
        $menu.append(renderItems(NT.value ? [NT.value] : []));
        return $menu;
    },
    renderHTML : function(){
        var NT = this;
        var $symbol = $('<div class="label label-inverse symbol">');
        $symbol.text(NT.symbol);
        var $container = $('<div>').addClass('options');
        $container.addClass('uid'+NT.uid);
        if(NT.value){
            $container.append(baseNode.renderHTML.call(this).addClass('selection'));
        } else {
            $container.append($symbol.clone());
        }
        var $btnGroup = $('<div class="btn-group">');
        var $menuBtn = $('<button>').addClass('btn').text('options');
        //TODO: Make menu stay open on selection.
        var $menu = null;
        $menuBtn.click(function(){
            if($menu){
                $menu.remove();
                $menu = null;
            } else {
                $menu = NT.renderMenuHTML();
                $container.append($menu);
            }
        });
        $btnGroup.append($menuBtn);
        $btnGroup.append($('<button class="btn dropdown-toggle" data-toggle="dropdown"><span class="caret"></span></button>'));
        var $otherOptions = $('<ul class="dropdown-menu">');
        $otherOptions.append($('<li><a>Inspect Object</a></li>'));
        $btnGroup.append($otherOptions);
        $container.append($btnGroup);
        $container.addClass('selection');
        return $container;
    }
});
function buildCFGraph(cfg, symbolObject){
    if(baseNode.isPrototypeOf(symbolObject)){
        //we've already processed this one.
        return symbolObject;
    }
    if(typeof symbolObject === "string"){
        symbolObject = { symbol : symbolObject };
    }
    if($.isArray(symbolObject)){
        var optionGroup = {items:[]};
        $.each(symbolObject, function(idx, item){
            optionGroup.items[idx] = buildCFGraph(cfg, item);
        });
        return inheritFrom(groupNode, optionGroup);
    }
    if(!symbolObject.symbol){
        //anonymous object
        symbolObject.symbol = 'gensym';
    }
    if(!symbolObject.options){
        if(symbolObject.symbol in cfg){
            symbolObject.options = cfg[symbolObject.symbol];
        } else {
            symbolObject.value = symbolObject.symbol;
            return inheritFrom(baseNode, symbolObject);
        }
    }
    var options = symbolObject.options;
    $.each(options, function(i){
        options[i] = buildCFGraph(cfg, options[i]);
    });
    return inheritFrom(baseNT, symbolObject);
}
