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
			Node nNode = nList.item(i);
			String accessor_url = nNode.getTextContent();

			int idx = accessor_url.indexOf("?");
			if (idx == -1) {
				accessor_url += ".xml?_language=traceur";
			} else {
				// Ugh, really Java? Every other runtime will do this for me
				String root = accessor_url.substring(0, idx);
				String params = accessor_url.substring(idx+1);
				accessor_url =  root + ".xml?";
				String rest;
				//System.out.println("--------------------");
				do {
					//System.out.println("accessor_url: " + accessor_url);
					//System.out.println("      params: " + params + "\n");
					int eidx = params.indexOf("=");
					int sidx = params.indexOf("&");
					String param = params.substring(0, eidx);
					String value;
					if (sidx != -1) {
						value = params.substring(eidx+1, sidx);
						params = params.substring(sidx+1);
					} else {
						value = params.substring(eidx+1);
						params = "";
					}

					accessor_url += URLEncoder.encode(param, "UTF-8");
					accessor_url += "=";
					accessor_url += URLEncoder.encode(value, "UTF-8");
					if (sidx != -1) {
						accessor_url += "&";
					}
				} while (params.length() > 0);
				//System.out.println("accessor_url: " + accessor_url);
				accessor_url += "&_language=traceur";
			}

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
		for (int i = 0; i < accessors.length; i++) {
			accessorElement = (Element) accessors[i].getDocumentElement();
			if (accessorElement.getAttribute("name").equals(args.accessor)) {
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
			Node valueNode = nodeMap.getNamedItem("value");

			String name = nameNode.getTextContent();
			String value = valueNode.getTextContent();

			parameters.put(name, value);
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

		exportInstanceMethod("version", "version");

		// TODO subinit

		engine.eval("log = new Object()");
		exportInstanceMethod("log.debug", "log_debug");
		exportInstanceMethod("log.info", "log_info");
		exportInstanceMethod("log.warn", "log_warn");
		exportInstanceMethod("log.error", "log_error");
		exportInstanceMethod("log.critical", "log_critical");

		engine.eval("time = new Object()");
		exportInstanceMethod("_time_sleep", "time_sleep");
		engine.eval("$traceurRuntime.ModuleStore.getAnonymousModule(function() { 'use strict'; time.sleep = $traceurRuntime.initGeneratorFunction(function $__0(time_in_ms) { return $traceurRuntime.createGeneratorInstance(function($ctx) { while (true) switch ($ctx.state) { case 0: _time_sleep(time_in_ms); $ctx.state = -2; break; default: return $ctx.end(); } }, $__0, this); }); return {}; });");
		engine.eval("time.run_later = function(delay_in_ms, fn_to_run, args) {"
				+ "log.warn('NotImplemented: time.run_later is a blocking sleep in this runtime');"
				+ "_time_sleep(delay_in_ms);"
				+ "fn_to_run(args);"
				+ "};");

		exportInstanceMethod("get", "get");
		exportInstanceMethod("set", "set");
		exportInstanceMethod("get_parameter", "get_parameter");

		// TODO socket

		engine.eval("http = Object()");
		exportInstanceMethod("_http_request", "http_request");
		engine.eval("$traceurRuntime.ModuleStore.getAnonymousModule(function() { 'use strict'; var o = Object(); http.request = $traceurRuntime.initGeneratorFunction(function $__0(url, method) { var properties, body, timeout; var $arguments = arguments; return $traceurRuntime.createGeneratorInstance(function($ctx) { while (true) switch ($ctx.state) { case 0: properties = $arguments[2] !== (void 0) ? $arguments[2] : null; body = $arguments[3] !== (void 0) ? $arguments[3] : null; timeout = $arguments[4] !== (void 0) ? $arguments[4] : null; $ctx.state = 4; break; case 4: $ctx.returnValue = _http_request(url, method, properties, body, timeout); $ctx.state = -2; break; default: return $ctx.end(); } }, $__0, this); }); return {}; });");
		exportInstanceMethod("_http_readURL", "http_readURL");
		engine.eval("$traceurRuntime.ModuleStore.getAnonymousModule(function() { 'use strict'; http.readURL = $traceurRuntime.initGeneratorFunction(function $__0(url) { return $traceurRuntime.createGeneratorInstance(function($ctx) { while (true) switch ($ctx.state) { case 0: $ctx.returnValue = _http_readURL(url); $ctx.state = -2; break; default: return $ctx.end(); } }, $__0, this); }); return {}; });");

		// TODO color

		// Load accessor code
		log.Debug("Loading accessor code");
		NodeList script = accessorElement.getElementsByTagName("script");
		Element wtf = (Element) script.item(0);
		String code = getCharacterDataFromElement(wtf);
		engine.eval(code);

		// Call accessor init
		log.Info("Initializing new accessor: " + args.accessor);
		// TODO: Handle init vs init*
		engine.eval("init().next()");
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

	public Object getPort(String port_name) {
		return ports.get(port_name).value;
	}

	public void setPort(String port_name, Object value) {
		ports.get(port_name).value = value;
	}

	public void firePort(String port_name, Object arg) throws Exception {
		engine.eval(
				"_fire = function(arg) {"
				+ port_name + "(arg).next();"
				+ "}");
		Invocable invocable = (Invocable) engine;
		invocable.invokeFunction("_fire", arg);
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

	public static void time_sleep(long time_in_ms) throws InterruptedException {
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
