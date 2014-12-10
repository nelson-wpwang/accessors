// vim: set ts=2 sts=2 sw=2 noet:

import java.util.Map;
import java.util.HashMap;

public class Log {
	public static final int DEBUG = 10;
	public static final int INFO = 20;
	public static final int WARN = 30;
	public static final int ERROR = 40;
	public static final int CRITICAL = 50;

	public int level = INFO;

	String _name;

	Log(String name) {
		_name = name;
	}

	static Map<String, Log> _logs = null;
	public static Log GetLog(String log_name) {
		if (_logs == null) {
			_logs = new HashMap<String, Log>();
		}

		Log log = _logs.get(log_name);
		if (log == null) {
			log = new Log(log_name);
			_logs.put(log_name, log);
		}
		return log;
	}

	public void Debug(String msg) {
		if (level <= DEBUG) System.out.println("DEBUG: " + _name + ": " + msg);
	}

	public void Info(String msg) {
		if (level <= INFO) System.out.println(" INFO: " + _name + ": " + msg);
	}

	public void Warn(String msg) {
		if (level <= WARN) System.out.println(" WARN: " + _name + ": " + msg);
	}

	public void Error(String msg) {
		if (level <= ERROR) System.out.println("ERROR: " + _name + ": " + msg);
	}

	public void Critical(String msg) {
		if (level <= CRITICAL) System.out.println(" CRIT: " + _name + ": " + msg);
	}

}
