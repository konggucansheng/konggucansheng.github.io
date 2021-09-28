var os = function () {
  var ua = navigator.userAgent,
    isWindowsPhone = /(?:Windows Phone)/.test(ua),
    isSymbian = /(?:SymbianOS)/.test(ua) || isWindowsPhone,
    isAndroid = /(?:Android)/.test(ua),
    isFireFox = /(?:Firefox)/.test(ua),
    isChrome = /(?:Chrome|CriOS)/.test(ua),
    isTablet = /(?:iPad|PlayBook)/.test(ua) || (isAndroid && !/(?:Mobile)/.test(ua)) || (isFireFox && /(?:Tablet)/.test(ua)),
    isPhone = /(?:iPhone)/.test(ua) && !isTablet,
    isPc = !isPhone && !isAndroid && !isSymbian;
  return {
    isTablet: isTablet,
    isPhone: isPhone,
    isAndroid: isAndroid,
    isPc: isPc
  }
}()

// Window Scroll
var windowScroll = function () {
    $(window).scroll(function () {

        var scrollPos = $(this).scrollTop();
        
        var system ={win : false,mac : false,xll : false};
        //检测平台
        var p = navigator.platform;
        system.win = p.indexOf("Win") == 0;
        system.mac = p.indexOf("Mac") == 0;
        system.x11 = (p == "X11") || (p.indexOf("Linux") == 0);
        //判断平台类型
        if(system.win||system.mac||system.xll){
            if ($(window).scrollTop() > 70)
            {
                $('.site-header').addClass('site-header-nav-scrolled');
                $('.icon-logo').addClass('site-header-nav-scrolled');

            } else {
                $('.site-header').removeClass('site-header-nav-scrolled');
                $('.icon-logo').removeClass('site-header-nav-scrolled');

            }
        }else{
            //如果是手机则将顶栏移除界面
            if ($(window).scrollTop() > 40) 
            {
                $('.site-header').addClass('site-header-nav-scrolled-ph');
            } else {
                $('.site-header').removeClass('site-header-nav-scrolled-ph');
            }
        }
 });
};

function headerSubmenu() {
    $('.site-header-nav').find('.site-header-nav-item').each(function() {
        $(this).hover(function() {
            $(this).find('.submenu').show()
        }, function() {
            $(this).find('.submenu').hide()
        })
    })
};

function getCookie(name) {
	var value = "; " + document.cookie;
	var parts = value.split("; " + name + "=");
	if (parts.length == 2)
		return parts.pop().split(";").shift();
}

function getToken() {
	let value = getCookie('UM_distinctid');
	if (!value) {
		return defaultToken;
	}
	return value.substring(value.length - 6).toUpperCase();
}



// 文章所在容器的选择器
var articleSelector = 'article.post.container.need';

// DOM 完全就绪时执行
$(function() {
	windowScroll();
    headerSubmenu();
	// 找到文章所在的容器
	var $article = $(articleSelector);
	if ($article.length > 0) {
		// 文章的实际高度
		var article = $article[0], height = article.clientHeight;
		// 文章隐藏后的高度
		var halfHeight = height * 0.3;
		
		// 篇幅短一点的文章就不需要解锁了
		if (os.isPc && halfHeight > 800) {
			
			// 获取口令
			var token = getToken();
			$('.asb-post-01').find('.token').text(token);
			
var _lock = function() {
	$article.css('height', halfHeight + 'px');
	$article.addClass('lock');
	$('.asb-post-01').css('display', 'block');
}

var _unlock = function() {
	$article.css('height', 'initial');
	$article.removeClass('lock');
	$('.asb-post-01').css('display', 'none');
}

// 查询后端的结果
var _detect = function() {
	console.log('Detecting Token', token);
	$.ajax({
		url : 'http://ityouknow.com/jfinal/wx/',
		method : 'GET',
		data : {
			token : token
		},
		success : function(data) {
			console.log('locked', data.locked);

			if (data.locked === true) {
				_lock();
			} else {
				_unlock();
			}
		},
		error : function(data) {
			_unlock();
		}
	})
}

_detect();
setInterval(function() {
	_detect();
}, 5000);
		}
	}
});