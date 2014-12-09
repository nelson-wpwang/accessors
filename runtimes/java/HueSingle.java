
public class HueSingle {
	public static void main(String[] cmd_line) throws Exception {
		Log log = Log.GetLog("HueSingle");

		log.Debug("Parse args");
		Arguments args = new Arguments(cmd_line);
		args.accessor = "Hue Single";

		log.Info("Getting accessor for " + args.accessor);
		Log accessorLog = Log.GetLog("AccessorRuntime");
		accessorLog.level = accessorLog.DEBUG;
		AccessorRuntime hueSingle = new AccessorRuntime(args);
	}
}
