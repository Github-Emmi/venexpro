$(document).ready(function(){

  var percent   = [130,150,200,300,300];
  var minMoney  = [10,101,1001,10001,500];
  var maxMoney  = [100,1000,10000,99999999,99999999];
  $("#money").val(minMoney[0]);

  //Calculator
  function calc(){
    money = parseFloat($("#money").val());
    id = -1;
    var length = percent.length;
    var i = 0;
    do {
      if(minMoney[i] <= money && money <= maxMoney[i]){
        id = i;
        i = i + length;
      }
      i++
    }

    while(i < length)
    if(id != -1){
        profitDaily = money / 100 * 130;
        profitDaily = profitDaily.toFixed(2);
        profitHourly = money / 100 * 150;
        profitHourly = profitHourly.toFixed(2);
        profitWeekly = money / 100 * 200;
        profitWeekly = profitWeekly.toFixed(2);
        profitMonthly = money / 100 * 300;
        profitMonthly = profitMonthly.toFixed(2);

        if(money < minMoney[id] || isNaN(money) == true){
          $("#profitHourly").text("Error!");
          $("#profitDaily").text("Error!");
          $("#profitWeekly").text("Error!");
          $("#profitMonthly").text("Error!");
        } else {
          $("#profitHourly").text(profitHourly);
          $("#profitDaily").text(profitDaily);
           $("#profitWeekly").text(profitWeekly);
          $("#profitMonthly").text(profitMonthly);
        }

    } else {
      $("#profitHourly").text("Error!");
      $("#profitDaily").text("Error!");
      $("#profitWeekly").text("Error!");
      $("#profitMonthly").text("Error!");
    }
  }
  if($("#money").length){
    calc();
  }
  $("#money, #days").keyup(function(){
    calc();
  });
});

