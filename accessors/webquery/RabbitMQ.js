// author:  Brad Campbell
// email:   bradjc@umich.edu
//
// Pull From a RabbitMQ Exchange
// ===========================
//
// This accessor connects to a RabbitMQ exchange and outputs data from the
// connected queue to the observe port.

function init() {
  // Create a single output observe port to publish data from the queue to.
  create_port('Data');
}

function data_callback (val) {
  send('Data', val);
}

Data.observe = function* () {
  var amqp_url = get_parameter('amqp_url');
  var exchange = get_parameter('amqp_exchange');
  var routing_key = get_parameter('amqp_routing_key');

  // Connect to the RabbitMQ server
  var amqp_conn = yield* rt.amqp.connect(amqp_url);

  // Setup a simple listener that will create a queue to the given exchange
  // with the given routing key and call `data_callback` every time a data packet
  // comes in.
  amqp_conn.subscribe(exchange, routing_key, data_callback);
}
