// vim: set ts=2 sts=2 sw=2 noet:

import java.io.*;
import java.lang.*;
import java.net.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;

import javax.script.*;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.DocumentBuilder;

import org.w3c.dom.*;


public class AccessorRuntime {
	Log log;
	Log runtimeLog;

	Map<String, String> parameters;
	Map<String, Port> ports;

	ScriptEngine engine;

	AccessorRuntime(Arguments args) throws Exception {
		log = Log.GetLog("AccessorRuntime");
		runtimeLog = Log.GetLog("AccessorRuntime." + args.accessor);
		if (log.level != runtimeLog.level) {
			runtimeLog.level = log.level;
		}

		// Get accessor list for location
		URL loc_url = new URL(args.server_host + "/accessors" + args.location + "accessors.xml");
		log.Debug("GET " + loc_url.toString());
		HttpURLConnection urlConnection = (HttpURLConnection) loc_url.openConnection();
		Document root_doc;
		try {
			int responseCode = urlConnection.getResponseCode();
			if (responseCode != urlConnection.HTTP_OK) {
				log.Error("Attempted request for " + loc_url.toString());
				log.Error("Error connecting to URL. Exiting.");
				System.exit(2);
			}

			DocumentBuilderFactory dbFactory = DocumentBuilderFactory.newInstance();
			DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
			root_doc = dBuilder.parse(loc_url.openStream());
		} finally {
			urlConnection.disconnect();
		}

		root_doc.getDocumentElement().normalize();

		// Get all of the accessors from that location
		List<Document> accessors_array = new ArrayList<Document>();
		NodeList nList = root_doc.getElementsByTagName("accessor");
		for (int i = 0; i < nList.getLength(); i++) {
			Node node = nList.item(i);
			NamedNodeMap nodeMap = node.getAttributes();
			String accessor_url = nodeMap.getNamedItem("path").getTextContent();

			accessor_url += ".xml?language=traceur";

			URL get_url = new URL(args.server_host + "/accessor" + accessor_url);
			log.Debug("GET " + get_url.toString());

			HttpURLConnection get_url_connection = (HttpURLConnection) get_url.openConnection();
			try {
				int responseCode = get_url_connection.getResponseCode();
				if (responseCode != get_url_connection.HTTP_OK) {
					log.Error("Attempted request for " + get_url.toString());
					log.Error("Error GET-ing URL. Exiting.");
					System.exit(2);
				}

				DocumentBuilderFactory dbFactory = DocumentBuilderFactory.newInstance();
				DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
				Document doc = dBuilder.parse(get_url.openStream());
				doc.getDocumentElement().normalize();

				accessors_array.add(doc);
			} finally {
				get_url_connection.disconnect();
			}
		}

		Document [] accessors = accessors_array.toArray( new Document[ accessors_array.size() ]);

		log.Debug("Accessors: ");
		for (int i = 0; i < accessors.length; i++) {
			Element eElement = (Element) accessors[i].getDocumentElement();
			log.Debug("\t" + eElement.getAttribute("name"));
		}

		Element accessorElement = null;
		NodeList accessorParameters = null;
		for (int i = 0; i < accessors.length; i++) {
			accessorElement = (Element) accessors[i].getDocumentElement();
			if (accessorElement.getAttribute("name").equals(args.accessor)) {
				accessorParameters = nList.item(i).getChildNodes();
				break;
			}
		}

		if (!accessorElement.getAttribute("name").equals(args.accessor)) {
			log.Error("Could not find accessor " + args.accessor);
			throw new Exception();
		}

		// Okay, now we have the accessor, parse out the interesting bits
		parameters = new HashMap<String, String>();
		NodeList parameterList = accessorElement.getElementsByTagName("parameter");
		for (int i = 0; i < parameterList.getLength(); i++) {
			Node parameterNode = parameterList.item(i);

			NamedNodeMap nodeMap = parameterNode.getAttributes();

			Node nameNode = nodeMap.getNamedItem("name");
			Node defNode = nodeMap.getNamedItem("default");

			if (defNode != null) {
				String name = nameNode.getTextContent();
				String def = defNode.getTextContent();

				if (def != null) {
					parameters.put(name, def);
				}
			}
		}

		// Override any default parameters as requested
		for (int i = 0; i < accessorParameters.getLength(); i++) {
			Node parameterNode = accessorParameters.item(i);

			NamedNodeMap nodeMap = parameterNode.getAttributes();

			Node nameNode = nodeMap.getNamedItem("name");
			Node valueNode = nodeMap.getNamedItem("value");

			String name = nameNode.getTextContent();
			String value = valueNode.getTextContent();

			if (value != null) {
				parameters.put(name, value);
			}
		}


		ports = new HashMap<String, Port>();
		NodeList inputList = accessorElement.getElementsByTagName("input");
		MakePortsFromNodeList(inputList, "input", ports);
		NodeList outputList = accessorElement.getElementsByTagName("output");
		MakePortsFromNodeList(outputList, "output", ports);
		NodeList inoutList = accessorElement.getElementsByTagName("inout");
		MakePortsFromNodeList(inoutList, "inout", ports);


		// create a script engine manager
		ScriptEngineManager factory = new ScriptEngineManager();
		// create JavaScript engine
		engine = factory.getEngineByName("nashorn");

		if (engine == null) {
			log.Warn("(Are you running Java 8?)");
			log.Critical("Failed to get nashorn engine. Dying.");
			assert false;
		}

		// Initialize traceur runtime
		log.Debug("Loading traceur runtime");
		engine.eval(new java.io.FileReader("bower_components/traceur-runtime/traceur-runtime.js"));

		// Initialize the accessor runtime
		log.Debug("Loading accessor runtime");

		engine.eval(
 "function _port_call (port, value) {"
+"	var r = port(value);"
+"	if (r && typeof r.next == 'function') {"
+"		r = r.next().value;"
+"	}"
+"	return r;"
+"}"
);

		engine.eval("rt = new Object()");

		exportInstanceMethod("rt.version", "version");

		engine.eval("create_port = function () { /* no-op */ };");

		// TODO subinit

		engine.eval("rt.log = new Object()");
		exportInstanceMethod("rt.log.debug", "log_debug");
		exportInstanceMethod("rt.log.info", "log_info");
		exportInstanceMethod("rt.log.warn", "log_warn");
		exportInstanceMethod("rt.log.error", "log_error");
		exportInstanceMethod("rt.log.critical", "log_critical");

		engine.eval("rt.time = new Object()");
		exportInstanceMethod("_time_sleep", "time_sleep");
		engine.eval("$traceurRuntime.ModuleStore.getAnonymousModule(function() { 'use strict'; rt.time.sleep = $traceurRuntime.initGeneratorFunction(function $__0(time_in_ms) { return $traceurRuntime.createGeneratorInstance(function($ctx) { while (true) switch ($ctx.state) { case 0: _time_sleep(time_in_ms); $ctx.state = -2; break; default: return $ctx.end(); } }, $__0, this); }); return {}; });");
		engine.eval("rt.time.run_later = function(delay_in_ms, fn_to_run, args) {"
				+ "rt.log.warn('NotImplemented: time.run_later is a blocking sleep in this runtime');"
				+ "_time_sleep(delay_in_ms);"
				+ "fn_to_run(args);"
				+ "};");

		exportInstanceMethod("get", "get");
		exportInstanceMethod("set", "set");
		exportInstanceMethod("get_parameter", "get_parameter");

		engine.eval("rt.socket = Object()");
		engine.eval(
"_create_socket = function (family, sock_type) {"
+"	var s = Object();"
+"	s._family = family;"
+"	s._sock_type = sock_type;"
+"	"
+"	s._sock = _runtime_socket(family, sock_type);"
+"	s._sendto = function (message, destination) {"
+"		return _runtime_sendto(s._sock, s._family, message, destination[0], destination[1]);"
+"	};"
+"	"
+"	$traceurRuntime.ModuleStore.getAnonymousModule(function() { 'use strict'; s.sendto = $traceurRuntime.initGeneratorFunction(function $__0(message, destination) { return $traceurRuntime.createGeneratorInstance(function($ctx) { while (true) switch ($ctx.state) { case 0: $ctx.returnValue = s._sendto(message, destination); $ctx.state = -2; break; default: return $ctx.end(); } }, $__0, this); }); return {}; });"
+"	"
+"	return s;"
+"}"
);
		exportInstanceMethod("_runtime_socket", "runtime_socket");
		exportInstanceMethod("_runtime_sendto", "runtime_sendto");
		engine.eval("$traceurRuntime.ModuleStore.getAnonymousModule(function() { 'use strict'; rt.socket.socket = $traceurRuntime.initGeneratorFunction(function $__0(family, sock_type) { return $traceurRuntime.createGeneratorInstance(function($ctx) { while (true) switch ($ctx.state) { case 0: $ctx.returnValue = _create_socket(family, sock_type); $ctx.state = -2; break; default: return $ctx.end(); } }, $__0, this); }); return {}; });");

		engine.eval("rt.http = Object()");
		exportInstanceMethod("_http_request", "http_request");
		engine.eval("$traceurRuntime.ModuleStore.getAnonymousModule(function() { 'use strict'; var o = Object(); rt.http.request = $traceurRuntime.initGeneratorFunction(function $__0(url, method) { var properties, body, timeout; var $arguments = arguments; return $traceurRuntime.createGeneratorInstance(function($ctx) { while (true) switch ($ctx.state) { case 0: properties = $arguments[2] !== (void 0) ? $arguments[2] : null; body = $arguments[3] !== (void 0) ? $arguments[3] : null; timeout = $arguments[4] !== (void 0) ? $arguments[4] : null; $ctx.state = 4; break; case 4: $ctx.returnValue = _http_request(url, method, properties, body, timeout); $ctx.state = -2; break; default: return $ctx.end(); } }, $__0, this); }); return {}; });");
		exportInstanceMethod("_http_readURL", "http_readURL");
		engine.eval("$traceurRuntime.ModuleStore.getAnonymousModule(function() { 'use strict'; rt.http.readURL = $traceurRuntime.initGeneratorFunction(function $__0(url) { return $traceurRuntime.createGeneratorInstance(function($ctx) { while (true) switch ($ctx.state) { case 0: $ctx.returnValue = _http_readURL(url); $ctx.state = -2; break; default: return $ctx.end(); } }, $__0, this); }); return {}; });");

		// TODO color

		// Load accessor code
		log.Debug("Loading accessor code");
		NodeList script = accessorElement.getElementsByTagName("script");
		Element wtf = (Element) script.item(0);
		String code = getCharacterDataFromElement(wtf);
		engine.eval(code);

		// Call accessor init
		log.Info("Initializing new accessor: " + args.accessor);
		engine.eval("_port_call(init, null)");
	}

	class PortMaker<T> {
		Port NewInput(String name) {
			Port port = new Port<T>(name);
			port.input = true;
			return port;
		}

		Port NewOutput(String name) {
			Port port = new Port(name);
			port.output = true;
			return port;
		}

		Port NewInout(String name) {
			Port port = new Port(name);
			port.input = true;
			port.output = true;
			return port;
		}
	}

	void MakePortsFromNodeList(NodeList list, String dir, Map<String, Port> ports) throws Exception {
		for (int i = 0; i < list.getLength(); i++) {
			Node node = list.item(i);
			NamedNodeMap nodeMap = node.getAttributes();

			String name = nodeMap.getNamedItem("name").getTextContent();
			String type = nodeMap.getNamedItem("type").getTextContent();
			// TODO: Other port parameters

			PortMaker portMaker;
			if (type.equals("button")) {
				throw new Exception("Not implemented: button port");
			} else if (type.equals("bool")) {
				portMaker = new PortMaker<Boolean>();
			} else if (type.equals("string")) {
				portMaker = new PortMaker<String>();
			} else if (type.equals("numeric")) {
				portMaker = new PortMaker<Double>();
			} else if (type.equals("integer")) {
				portMaker = new PortMaker<Integer>();
			} else if (type.equals("select")) {
				throw new Exception("Not implemented: select port");
			} else if (type.equals("color")) {
				log.Warn("Not implemented: color port");
				continue;
			} else {
				throw new Exception("Bad Port Type");
			}

			Port port;
			if (dir.equals("input")) {
				port = portMaker.NewInput(name);
			} else if (dir.equals("output")) {
				port = portMaker.NewOutput(name);
			} else if (dir.equals("inout")) {
				port = portMaker.NewInout(name);
			} else {
				throw new Exception("Illegal port direction");
			}

			ports.put(name, port);
		}
	}

	class Port<T> {
		String name;
		T value;
		boolean input = false;
		boolean output = false;

		Port(String port_name) {
			name = port_name;
		}

		public T get() {
			assert input;
			if (value == null) {
				log.Debug("Port.get("+name+") => null");
			} else {
				log.Debug("Port.get("+name+") => " + value.toString());
			}
			return value;
		}

		public void set(T new_value) {
			assert output;
			log.Debug(name);
			if (new_value == null) {
				log.Debug("Port.set("+name+") <= <null>");
			} else {
				log.Debug("Port.set("+name+") <= " + new_value.toString());
			}
			value = new_value;
		}

		public String toString() {
			return name;
		}
	}

	public Object getPort(String port_name) throws Exception {
		Port port = ports.get(port_name);
		if (port == null) {
			throw new Exception("Cannot get. No such port: " + port_name);
		} else {
			return port.value;
		}
	}

	public void setPort(String port_name, Object value) throws Exception {
		Port port = ports.get(port_name);
		if (port == null) {
			throw new Exception("Cannot set. No such port: " + port_name);
		} else {
			port.value = value;
		}
	}

	void _firePort(String port_name, Object arg) throws Exception {
		engine.eval(
				"_fire = function(arg) {"
				+ "if (typeof " + port_name + " != 'function') {"
				+ "  rt.log.warn('I want to remove direct call to port => implicit fire');"
				+ "  _port_call(fire, arg);"
				+ "} else {"
				+ "  _port_call("+port_name+", arg);"
				+ "}"
				+"}");
		Invocable invocable = (Invocable) engine;
		invocable.invokeFunction("_fire", arg);
	}

	public void firePort(String port_name) throws Exception {
		_firePort(port_name, getPort(port_name));
	}

	public void setAndFirePort(String port_name, Object arg) throws Exception {
		setPort(port_name, arg);
		firePort(port_name);
	}

	public void fire() throws Exception {
		_firePort("fire", null);
	}

	// http://stackoverflow.com/questions/11553697/
	String getCharacterDataFromElement(Element e) {
		NodeList list = e.getChildNodes();
		String data;

		for (int i = 0; i < list.getLength(); i++) {
			if (list.item(i) instanceof CharacterData) {
				CharacterData child = (CharacterData) list.item(i);
				data = child.getData();

				if (data != null && data.trim().length() > 0) {
					return child.getData();
				}
			}
		}
		log.Error("Request CDATA from not CDATA element");
		return "";
	}

	// http://stackoverflow.com/questions/326390/
	static String readFile(String path) throws IOException {
		byte[] encoded = Files.readAllBytes(Paths.get(path));
		return new String(encoded);
	}

	// ACCESSOR RUNTIME

	void exportInstanceMethod(String js_method, String java_method) throws Exception {
		/* This doesn't work, throws an exception (Java bug)
		engine.eval(
			  "_wrap = function(th) {"
			+ "  "+js_method+" = th."+java_method+";"
			+ "}");
			*/
		engine.eval(
			  "_wrap = function(th) {"
			+ "  "+js_method+" = function() {"
			// And for more fun, can't use .apply since it's not supported, so instead we hack:
			+ "    if (arguments.length == 0) {"
			+ "      return th."+java_method+"();"
			+ "    } else if (arguments.length == 1) {"
			+ "      return th."+java_method+"(arguments[0]);"
			+ "    } else if (arguments.length == 2) {"
			+ "      return th."+java_method+"(arguments[0], arguments[1]);"
			+ "    } else if (arguments.length == 3) {"
			+ "      return th."+java_method+"(arguments[0], arguments[1], arguments[2]);"
			+ "    } else if (arguments.length == 4) {"
			+ "      return th."+java_method+"(arguments[0], arguments[1], arguments[2], arguments[3]);"
			+ "    } else if (arguments.length == 5) {"
			+ "      return th."+java_method+"(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]);"
			+ "    } else {"
			+ "      throw 'Runtime error, _warp hack max argument length';"
			+ "    }"
			+ "  };"
			+ "}");
		Invocable invocable = (Invocable) engine;
		invocable.invokeFunction("_wrap", this);
	}

	// ### GENERAL UTILITY
	public String version() {
		return "0.1.0";
	}
	public String version(String set_to) {
		if (!set_to.equals("0.1.0")) {
			runtimeLog.Warn("Request for runtime version " + set_to + " ignored.");
		}
		return version();
	}

	// So, I tried passing an actual class to JS as an object, b/c in principle I
	// think you can do that, but that gave me this awesome error:
	//   Exception in thread "main" java.lang.IncompatibleClassChangeError: AccessorRuntime and AccessorRuntime$RuntimeLog disagree on InnerClasses attribute
	// which is beyond the amount of java I know or understand (and may actually
	// be a JVM bug from some reading), so... we'll make the object in JS and just
	// export individaul functions for everything, no real difference I don't think
	public void log_debug(String msg) {
		runtimeLog.Debug(msg);
	}

	public void log_info(String msg) {
		runtimeLog.Info(msg);
	}

	public void log_warn(String msg) {
		runtimeLog.Warn(msg);
	}

	public void log_error(String msg) {
		runtimeLog.Error(msg);
	}

	public void log_critical(String msg) throws RuntimeException {
		runtimeLog.Critical(msg);
		throw new RuntimeException();
	}

	public void time_sleep(long time_in_ms) throws InterruptedException {
		Thread.sleep(time_in_ms);
	}

	// ### ACCESSOR INTERFACE AND PROPERTIES

	// TODO polymorphic return type?
	public Object get(String port_name) {
		Port port = ports.get(port_name);
		Object ret = ports.get(port_name).get();
		if (ret == null) {
			runtimeLog.Debug("get(" + port_name + ") => null");
		} else {
			runtimeLog.Debug("get(" + port_name + ") => " + ret.toString());
		}
		return ret;
	}

	// TODO polymorphic set value?
	public void set(String port_name, Object value) {
		Port port = ports.get(port_name);
		port.set(value);
		if (value == null) {
			runtimeLog.Debug("set(" + port_name + ", null)");
		} else {
			runtimeLog.Debug("set(" + port_name + "," + value.toString() + ")");
		}
	}

	public String get_parameter(String parameter_name) {
		String ret = parameters.get(parameter_name);
		runtimeLog.Debug("get_parameter(" + parameter_name + ") => " + ret);
		return ret;
	}


	// ### SOCKETS

	// You might think that it would make sense for a socket instance
	// to be a class, since that's what it is on the JS side, but trying
	// to do anything but export simple member functions seems to find
	// ever new and more interesting Java<>JavaScript bugs (this comment
	// hails from early JDK 8 (u25) days, fwiw), so... fuck it.

	public Object runtime_socket(String family, String sock_type) throws Exception {
		Object s;
		if (sock_type.equals("SOCK_DGRAM")) {
			s = new DatagramSocket();
		} else {
			throw new Exception("Not Implemented: socket type " + sock_type);
		}

		if (! (family.equals("AF_INET") || family.equals("AF_INET6")) ) {
			throw new Exception("Not Implemented: family " + family);
		}
		return s;
	}

	public void runtime_sendto(
			Object s, String family,
			String message,
			String dest_address, int dest_port)
		throws Exception
	{
		assert s instanceof DatagramSocket;
		DatagramSocket socket = (DatagramSocket) s;

		InetAddress address;
		if (family.equals("AF_INET")) {
			address = InetAddress.getByName(dest_address);
		} else if (family.equals("AF_INET6")) {
			address = Inet6Address.getByName(dest_address);
		} else {
			throw new Exception("Unknown family: " + family);
		}

		byte[] payload = message.getBytes();

		DatagramPacket packet = new DatagramPacket(
				payload, payload.length, address, dest_port);

		socket.send(packet);
	}


	// ### HTTP REQUESTS
	public String http_request(String url_str, String method, String properties, String body, int timeout) throws Exception {
		// http://stackoverflow.com/questions/1051004/
		URL url = new URL(url_str);
		HttpURLConnection httpCon = (HttpURLConnection) url.openConnection();
		httpCon.setDoOutput(true);
		httpCon.setRequestMethod(method);
		OutputStreamWriter out = new OutputStreamWriter( httpCon.getOutputStream());
		out.write(body);
		out.close();
		String resp = URLConnectionReader.getTextFromStream(httpCon.getInputStream());
		runtimeLog.Debug("http_request(" + url + ", ...) => " + resp);
		return resp;
	}

	public String http_readURL(String url) throws Exception {
		String resp = URLConnectionReader.getText(url);
		runtimeLog.Debug("http_readURL(" + url + ") => " + resp);
		return resp;
	}
}

// http://stackoverflow.com/questions/4328711/
class URLConnectionReader {
	public static String getText(String url) throws Exception {
		URL website = new URL(url);
		URLConnection connection = website.openConnection();
		return getTextFromStream(connection.getInputStream());
	}

	public static String getTextFromStream(InputStream is) throws Exception {
		BufferedReader in = new BufferedReader(
				new InputStreamReader(is));

		StringBuilder response = new StringBuilder();
		String inputLine;

		while ((inputLine = in.readLine()) != null)
			response.append(inputLine);

		in.close();

		return response.toString();
	}
}
