// name:   Print
// author: Brad Campbell
// email: bradjc@umich.edu

/* Print Accessor
 * ======================
 *
 * Strictly input, simply prints whatever is received on its port.
 */


function* init () {
	create_port('Print');
}

Print.input = function* (content) {
	rt.log.log(content);
}
