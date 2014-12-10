// vim: set ts=2 sts=2 sw=2 noet:

public class HueSingle {
	public static void main(String[] cmd_line) throws Exception {
		Log log = Log.GetLog("HueSingle");

		log.Debug("Parse args");
		Arguments args = new Arguments(cmd_line);
		args.accessor = "Hue Single";

		log.Info("Getting accessor for " + args.accessor);
		//Log accessorLog = Log.GetLog("AccessorRuntime");
		//accessorLog.level = accessorLog.DEBUG;
		AccessorRuntime hueSingle = new AccessorRuntime(args);

		hueSingle.setPort("BulbName", "Pat");

		log.Info("Setting power on");
		hueSingle.setAndFirePort("Power", true);
		Thread.sleep(2000);

		log.Info("Setting power off");
		hueSingle.setAndFirePort("Power", false);
		Thread.sleep(2000);

		log.Info("Setting power on");
		hueSingle.set("Power", true);
		hueSingle.firePort("Power");

		log.Info("Done. Goodbye.");
	}
}
