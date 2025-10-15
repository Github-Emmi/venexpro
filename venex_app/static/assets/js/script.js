/*
tinc project builder
jsFile create on 27.07.2018 09:13:54
*/
$(document).ready(function () {

  var ua = detect.parse(navigator.userAgent);
  $("html").addClass(ua.browser.family);

  $('select:not(.paySysList)').map(function () {
    $('select').selectric();
  });

  $('.enterNum').bind("change keyup input click", function () {
    if (this.value.match(/[^0-9]/g)) {
      this.value = this.value.replace(/[^0-9]/g, '');
    }
  });


  function clock() {
    var date = new Date(),
      hour = date.getHours(),
      min = date.getMinutes(),
      day = date.getDate(),
      month = date.getMonth(),
      monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      year = date.getFullYear();

    if (hour < 10) hour = '0' + hour;
    if (min < 10) min = '0' + min;
    if (day < 10) day = '0' + day;

    document.getElementById('time').innerHTML = hour + ':' + min;
    document.getElementById('day').innerHTML = day + ' ' + monthArr[month];
    document.getElementById('year').innerHTML = year;
  }

  var timer;

  function clockStart() {
    timer = setInterval(clock, 60000);
    clock();
  }

  clockStart();

  var faqHead = $('.faqItem .head'),
    faqContent = $('.faqItem .content');

  if ($('.faqItem').length > 0) {
    $('.faqItem').map(function () {
      var el = $(this)
      if (el.find(faqHead).length > 0 && el.find(faqContent).length > 0) {
        $('.faqItem .head:not(.active)').siblings(faqContent).slideUp();

        el.find(faqHead).on('click', function () {
          var el = $(this),
            cont = el.siblings(faqContent),
            icon = el.find('.icon-faq');

          if (el.hasClass('active')) {
            cont.stop().slideUp(500);
            el.removeClass('active');
          } else {
            cont.stop().slideDown(500);
            el.addClass('active');
          }
          if (icon.hasClass('gradTxt')) {
            icon.removeClass('gradTxt');
          } else {
            icon.addClass('gradTxt');
          }
        })
      }
    })
  }

  new ClipboardJS('.copyBtn');

  $('select.paySysList:not([data-id])').map(function () {
    $(this).selectric({
      onInit: function () {
        pushSelectricItemsPayImg(this)
        changeSelectricPayImg($(this).parents(".selectric-wrapper"))
      },
      onChange: function () {
        changeSelectricPayImg($(this).parents(".selectric-wrapper"))
      }
    });
  });


  $(".payForm").map(function(){
    var el = $(this)
    var active = el.find("[type=radio]:checked").attr("id")
    $('select.paySysList[data-id]').map(function () {
      $(this).selectric({
        onInit: function () {
          pushSelectricItemsPayImg(this)
          changeSelectricPayImg($(this).parents(".selectric-wrapper"))
          if ($(this).attr("data-id") == active){
            $(this).parents(".selectric-wrapper").addClass("active")
          }
        },
        onChange: function () {
          changeSelectricPayImg($(this).parents(".selectric-wrapper"))
        }
      });
    });
    el.find("[name='payMet']").on("change",function(){
      var active = $(this).attr("id");
      $('.paySysList').removeAttr('name');
      $(this).parents(".payForm").find("[data-id='"+active+"']").parents(".selectric-wrapper").addClass("active").siblings(".selectric-wrapper").removeClass("active");
      $(this).parents(".payForm").find("[data-id='"+active+"']").attr('name', 'type');
    })
      // console.log(el.find(".selectric-wrapper"), active)
      // wrapper.parents(".selectric-wrapper").addClass("active").siblings(".selectric-wrapper").removeClass("active")
  })

  if ($('.filter').length > 0) {
    var dateFormat = "mm/dd/yy",
      from = $(".fromDate")
      .datepicker({
        defaultDate: "+1w",
        changeMonth: true,
        numberOfMonths: 1
      })
      .on("change", function () {
        to.datepicker("option", "minDate", getDate(this));
      }),
      to = $(".toDate").datepicker({
        defaultDate: "+1w",
        changeMonth: true,
        numberOfMonths: 1
      })
      .on("change", function () {
        from.datepicker("option", "maxDate", getDate(this));
      });

    function getDate(element) {
      var date;
      try {
        date = $.datepicker.parseDate(dateFormat, element.value);
      } catch (error) {
        date = null;
      }

      return date;
    }
  }

  var refHead = $('.refItem .head'),
    refContent = $('.refItem .content');

  if ($('.refItem').length > 0) {
    $('.refItem').map(function () {
      var el = $(this)
      if (el.find(refHead).length > 0 && el.find(refContent).length > 0) {
        $('.refItem .head:not(.active)').siblings(refContent).slideUp();

        el.find(refHead).on('click', function () {
          var el = $(this),
            cont = el.siblings(refContent);

          if (el.hasClass('active')) {
            cont.stop().slideUp(300);
            el.removeClass('active');
          } else {
            cont.stop().slideDown(300);
            el.addClass('active');
          }
        })
      }
    })
  }

})

var changeSelectricPayImg = function (el) {
  el
    .find('.label')
    .append(
      el
      .find(".selectric-items li.selected .paySysImg")
      .clone()
    )
}
var pushSelectricItemsPayImg = function (el) {
  $(el).find("option").map(function () {
    var el = $(this);
    var payImg = el.attr("data-img");

    var li = $(this).parents(".selectric-wrapper").find("li").eq(el.index());
    var liText = li.text();
    li.html("<span class='paySysImg'></span>" + liText);

    var liImg = li.find('.paySysImg');
    liImg.attr("style", payImg);

  })
}