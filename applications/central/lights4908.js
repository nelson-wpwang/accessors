
function Lights4908 (parameters, finished) {

	var inputs = [

		function (state) {
			if (state) {
				console.log('Lights4908: turning lab lights on');
			} else {
				console.log('Lights4908: turning lab lights off');
			}
		}

	]
	this.inputs = inputs;

	finished();
}

module.exports = Lights4908;
