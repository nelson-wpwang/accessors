// author:  Brad Campbell
// email:   bradjc@umich.edu
//
// Pull From GATDv0.1
// ===========================
//

var gatd_conn;

function init() {
  // Create a single output observe port to publish data from the queue to.
  create_port('Data');
}

Data.observe = function* (enable) {
  var gatd_url = get_parameter('gatd_url');
  var query = JSON.parse(get_parameter('gatd_query'));

  if (enable) {
    // Connect to the GATD
    gatd_conn = yield* rt.gatd_old.connect(gatd_url);

    // Setup a simple listener that will create a queue to the given exchange
    // with the given routing key and call `callback` every time a data packet
    // comes in.
    gatd_conn.query(query, function (value) {
      send('Data', value);
    });
  }
}
