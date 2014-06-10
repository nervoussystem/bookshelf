

exports.init = function() {
  var widthUI = document.getElementById("widthUI");
  var heightUI = document.getElementById("heightUI");
  
  widthUI.addEventListener("change", updateWidth, false);
  heightUI.addEventListener("change", updateHeight, false);
}

var updateWidth = function(event) {
  console.log(event.target.value);
};

var updateHeight = function(event) {
  
};