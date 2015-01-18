package com.umich.mycolor.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.os.AsyncTask;
import android.os.Bundle;
import android.os.Handler;
import android.speech.RecognizerIntent;
import android.util.Log;
import android.util.Pair;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import com.larswerkman.holocolorpicker.ColorPicker;
import org.apache.http.HttpResponse;
import org.apache.http.client.ClientProtocolException;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.protocol.HTTP;
import org.apache.http.util.EntityUtils;
import org.json.JSONObject;

import java.io.IOException;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;


public class MainActivity extends Activity implements ColorPicker.OnColorChangedListener {
    private static ColorPicker colorPicker;
    private Button setColorBTN;
    private ImageButton voiceBTN;
    private BluetoothAdapter mBluetoothAdapter;
    private int REQUEST_ENABLE_BT = 1;

    private boolean ble_debug = true;
    private boolean color_debug = false;
    private boolean max_debug = false;

    private Transmitter transmitter;

    private String manual_url = "";

    //private HashMap<String, Pair<Integer, ArrayList<Pair<Integer, Long>>>> rssi_bank; //used for the rssi max stuff
    private HashMap<String, ArrayList<Integer>> rssi_bank; //used for the rssi max stuff

    private static int maxCalcDelayMS = 10000; //milliseconds
    private String cur_url = "http://requestb.in/1bxt9ut1";
    private Handler h;

    private Integer NUM_OLD_RSSI_CHART = 15;

    private String COLOR_HEX = "0x000000";
    private Integer TIME_DECAY = 10000;
    private Integer CUR_MAX_AVG = -1;
    private String UNIQUE_ID = "BB12";
    private Integer RSSI_THRESH = -60;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        final Activity activity = this;
        activity.setTitle("Main");

        setup_ble();
        setup_gui();
        setup_voice();


        rssi_bank = new HashMap<String, ArrayList<Integer>>();


        //h = new Handler(); //periodically recalculate maxes


        // This spawns the thread that periodically checks for the current max RSSI device
        // everything else is done with the BLE Callback
        //init_rssi_max_calculator();

        //We are not using this anymore for now...
        //rssi_bank = new HashMap<String, Pair<Integer, ArrayList<Pair<Integer, Long>>>>();

    }




    //Get the BLE Callback...
    private BluetoothAdapter.LeScanCallback leScanCallback = new BluetoothAdapter.LeScanCallback() {
        @Override
        public void onLeScan(final BluetoothDevice device, final int rssi, final byte[] scanRecord) {



            if (ble_debug) {
                //if (device.getAddress().equals(ADDRESS_STR)) {
                String byte_str = bytesToHex(scanRecord);
                int index = byte_str.indexOf(UNIQUE_ID); //Hack... should be able to find type FF
                if (index != -1) {
                    String hex_size = byte_str.substring(index - 4, index - 2);
                    Integer dec_size = Integer.parseInt(hex_size, 16) - 3;
                    String data = byte_str.substring(index + 4, index + 4 + (dec_size * 2));
                    String url = convertHexToString(data);
                    if (url.indexOf("umhue02") != -1) {
                        url = "http://169.229.223.74:3000/misc/mycolor/umhue02/lighting/rgb/Color";
                    }
                    if (url.indexOf("umhue03") != -1) {
                        url = "http://169.229.223.74:3000/misc/mycolor/umhue03/lighting/rgb/Color";
                    }
                    if (url.indexOf("umhue04") != -1) {
                        url = "http://169.229.223.74:3000/misc/mycolor/umhue04/lighting/rgb/Color";
                    }
                    if (url.indexOf("umhue05") != -1) {
                        url = "http://169.229.223.74:3000/misc/mycolor/umhue05/lighting/rgb/Color";
                    }
                    if (url.indexOf("umhue06") != -1) {
                        url = "http://169.229.223.74:3000/misc/mycolor/umhue06/lighting/rgb/Color";
                    }
                    if (url.indexOf("umhue07") != -1) {
                        url = "http://169.229.223.74:3000/misc/mycolor/umhue07/lighting/rgb/Color";
                    }
                    if (ble_debug) {
                        //Log.i("BLE:HIT", "##################");
                        //Log.i("BLE: RRSI", String.valueOf(rssi));
                        //Log.i("BLE: INDEX", String.valueOf(index));
                        //Log.i("BLE: HEX_SIZE", hex_size);
                        //Log.i("BLE: SIZE", String.valueOf(dec_size));
                        //Log.i("BLE: DATA", data);
                        //Log.i("BLE: URL", url);
                        if (rssi >= RSSI_THRESH) {
                            //show_toast(url);
                            if (!cur_url.equals(url)) {
                                Log.i("BLE: URL", url);
                                cur_url = url;
                                int color = colorPicker.getColor();
                                COLOR_HEX = Integer.toHexString(color);
                                Log.i("BLE: COLOR", COLOR_HEX);
                                if (rssi_bank.get(url) == null) {
                                    rssi_bank.put(url, new ArrayList<Integer>());
                                }
                                if (rssi_bank.get(url).size() >= NUM_OLD_RSSI_CHART){
                                    rssi_bank.get(url).remove(0);
                                }
                                rssi_bank.get(url).add(rssi);
                                Transmitter transmitter = new Transmitter();
                                TransmitterType toTransmit = new TransmitterType(url, COLOR_HEX);
                                transmitter.execute(toTransmit);
                            }
                        }
                    }
                }
                if (ble_debug) {
                    //Log.i("BLE:", bytesToHex(scanRecord));
                }
            }
            //}
            //parse(device, rssi);
        }
    };


    @Override
    public void onColorChanged(int color) {

    }

    private static class TransmitterType {
        String url;
        String color;

        TransmitterType(String url, String color) {
            this.url = url;
            this.color = color;
        }
    }


    private class Transmitter extends AsyncTask<TransmitterType, Void, Void> {

        @Override
        protected Void doInBackground(TransmitterType... args) {

            String url = args[0].url;
            String color = args[0].color;
            post(url, color);
            Log.w("POSTING", "STARTING TRANSMITTER");
            return null;
        }

        private void post(String url, String color) {
            Log.w("POST: url", url);
            Log.w("POST: color", color);
            if (url != "") {
                JSONObject jsComm = new JSONObject();
                HttpClient httpclient = new DefaultHttpClient();
                HttpPost httppost = new HttpPost(url);
                String responseBody = "";
                HttpResponse response = null;
                try {
                    httppost.setHeader(HTTP.CONTENT_TYPE, "text/plain");
                    String truncated_color = color.substring(2);
                    //jsComm.put("color", String.valueOf(truncated_color));
                   // Log.w("POST data:", truncated_color);
                    httppost.setEntity(new StringEntity(truncated_color, "UTF-8"));
                    response = httpclient.execute(httppost);

                    if (response.getStatusLine().getStatusCode() == 200) {
                        Log.d("POST: response ok", response.toString());
                    } else {
                        Log.d("POST: response not ok", "Something went wrong :/");
                    }
                    try {
                        responseBody = EntityUtils.toString(response.getEntity());
                        Log.w("POST: respose", responseBody);
                    } catch (IOException e) {
                    }
                } catch (ClientProtocolException e) {
                    e.printStackTrace();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
        }
    }
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 1 && resultCode == RESULT_OK) {
            ArrayList<String> thingsYouSaid = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            boolean color_found = false;
            for (int i = 0; i < thingsYouSaid.size(); i++) {
                Log.i("VOICE", thingsYouSaid.get(i));
                if (thingsYouSaid.get(i).equals("red")) {
                    COLOR_HEX = "FFFF000D";
                    color_found = true;
                    break;
                } else if (thingsYouSaid.get(i).equals("green")) {
                    COLOR_HEX = "FF00FF33";
                    color_found = true;
                    break;
                } else if (thingsYouSaid.get(i).equals("yellow")) {
                    COLOR_HEX = "FFFFEE00";
                    color_found = true;
                    break;
                } else if (thingsYouSaid.get(i).equals("orange")) {
                    COLOR_HEX = "FFFFB300";
                    color_found = true;
                    break;
                } else if (thingsYouSaid.get(i).equals("blue")) {
                    COLOR_HEX = "FF0004FF";
                    color_found = true;
                    break;
                } else if (thingsYouSaid.get(i).equals("white")) {
                    COLOR_HEX = "FFFFFFFF";
                    color_found = true;
                    break;
                } else if (thingsYouSaid.get(i).equals("off")) {
                    COLOR_HEX = "FF000000";
                    color_found = true;
                    break;
                } else if (thingsYouSaid.get(i).equals("purple")) {
                    COLOR_HEX = "FFE6001F";
                    color_found = true;
                    break;
                } else if (thingsYouSaid.get(i).equals("moms") ||
                        thingsYouSaid.get(i).equals("mobs") ||
                        thingsYouSaid.get(i).equals("mob") ||
                        thingsYouSaid.get(i).equals("moms") ||
                        thingsYouSaid.get(i).equals("mauve") ||
                        thingsYouSaid.get(i).equals("malls") ||
                        thingsYouSaid.get(i).equals("mom") ||
                        thingsYouSaid.get(i).equals("Mazz")) {
                    COLOR_HEX = "FFE0B0FF";
                    color_found = true;
                    break;
                } else if (thingsYouSaid.get(i).contains("Ox") || thingsYouSaid.get(i).contains("ox")
                       || thingsYouSaid.get(i).contains("0x") || thingsYouSaid.get(i).contains("oh")) {
                    String cur_str = thingsYouSaid.get(i);
                    cur_str = cur_str.replace("0x", "");
                    cur_str = cur_str.replace("Ox", "");
                    cur_str = cur_str.replace("ox", "");
                    cur_str = cur_str.replaceAll("\\s+","");
                    Log.w("VOICE", cur_str);
                    if (cur_str.length() == 6) {
                        COLOR_HEX = "FF" + cur_str;
                        color_found = true;
                        break;
                    }
                }

            }
            Log.i("VOICE: Found Color", String.valueOf(color_found));
            if (color_found) {
                Log.i("VOICE: color picker: ", String.valueOf(colorPicker.getColor()));
                if (colorPicker != null) {
                    BigInteger value = new BigInteger(COLOR_HEX, 16); //a bit hacky... can probably do with integer
                    int color = value.intValue();
                    Log.w("VOICE", String.valueOf(value.intValue()));
                    colorPicker.setColor(color);
                    colorPicker.setNewCenterColor(color);
                }
                Transmitter transmitter = new Transmitter();
                TransmitterType toTransmit = new TransmitterType(cur_url, COLOR_HEX);
                transmitter.execute(toTransmit);
            }
        }
    }


    //*****************************************
    //* INIT FUNCTIONS
    //*****************************************
    private void init_rssi_max_calculator() {
        h.postDelayed(new Runnable() {
            public void run() {
                //do something
                if (max_debug) {
                    Log.i("MAX", "hb");
                }
                //update_max();
                //post();
                h.postDelayed(this, maxCalcDelayMS);
            }
        }, maxCalcDelayMS);
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        MenuInflater inflater = getMenuInflater();
        inflater.inflate(R.menu.menu_main, menu);
        return true;
    }

    public void showManualControl() {
        AlertDialog.Builder alert = new AlertDialog.Builder(this);
        alert.setTitle("Set Server");
        alert.setMessage("URL");
        final EditText input = new EditText(this);
        if (manual_url.equals("")) {
            input.setText("http://www.");

        } else {
            input.setText(manual_url);
        }
        alert.setView(input);

        alert.setPositiveButton("SET", new DialogInterface.OnClickListener() {
            public void onClick(DialogInterface dialog, int whichButton) {
                manual_url = input.getText().toString();
            }
        });
        alert.show();
    }



    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Handle item selection
        switch (item.getItemId()) {
            //case R.id.manual_control:
            //    showManualControl();
            //    return true;
            //case R.id.rssi_graph:
                //showHelp();
            //    Intent intent = new Intent(MainActivity.this, Grapher.class);
            //    intent.putExtra("hashMap", rssi_bank);
            //    startActivity(intent);
            //    return true;
            case R.id.about:
                showAbout();
                //showHelp();
                return true;
            default:
                return super.onOptionsItemSelected(item);
        }
    }

    protected void setup_ble() {
        final BluetoothManager bluetoothManager =
                (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        mBluetoothAdapter = bluetoothManager.getAdapter();
        if (mBluetoothAdapter == null || !mBluetoothAdapter.isEnabled()) {
            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            startActivityForResult(enableBtIntent, REQUEST_ENABLE_BT);
        }
        mBluetoothAdapter.startLeScan(leScanCallback);
    }

    private void setup_gui() {
        colorPicker = (ColorPicker) findViewById(R.id.colorPicker);
        //colorPickerObj.setColorPicker(colorPicker);
        setColorBTN = (Button) findViewById(R.id.setColorBTN);
        voiceBTN = (ImageButton) findViewById(R.id.voiceBTN);

        colorPicker.setOnColorChangedListener(this);

        voiceBTN.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, "en-US");
                try {
                    startActivityForResult(i, 1);
                } catch (Exception e) {
                    //Toast.makeText(this, "Error initializing speech to text engine.", Toast.LENGTH_LONG).show();
                }
            }
        });


        setColorBTN.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                int color = colorPicker.getColor();
                COLOR_HEX = Integer.toHexString(color);
                if (color_debug) {
                    Log.i("COLOR:textColor", "test");
                }
                colorPicker.setOldCenterColor(colorPicker.getColor());
                colorPicker.setNewCenterColor(colorPicker.getColor());
                Transmitter transmitter = new Transmitter();
                TransmitterType toTransmit = new TransmitterType(cur_url, COLOR_HEX);
                transmitter.execute(toTransmit);
            }
        });
    }

    private void showAbout() {
        AlertDialog.Builder alertDialogBuilder = new AlertDialog.Builder(MainActivity.this);

        alertDialogBuilder.setTitle("About");
        alertDialogBuilder.setMessage("This app was created for Terraswarm by Lab11 at the University of Michigan. \n " +
                "It forwards color data to a server specified in the advertisement packet of a BLE device. \n" +
                "This server will then change the color of a hue lightbulb to match the users preference \n \n" +
                " The acceptable colors for voice recognition are Blue, Red, White, Purple, Green, Mauve, Yellow and Orange. " +
                "Additionally, you can say off. Also, you can also specify a hex value with your voice by starting the 6 digit hex with either Ox or 0x.");

        alertDialogBuilder.setNeutralButton("OK",new DialogInterface.OnClickListener() {
            public void onClick(DialogInterface dialog,int id) {

            }
        });
        AlertDialog alertDialog = alertDialogBuilder.create();
        alertDialog.show();
    }


    private void setup_voice() {
    }


    //*****************************************
    //* HELPER FUNCTIONS
    //*****************************************
    final protected static char[] hexArray = "0123456789ABCDEF".toCharArray();

    public static String bytesToHex(byte[] bytes) {
        char[] hexChars = new char[bytes.length * 2];
        for (int j = 0; j < bytes.length; j++) {
            int v = bytes[j] & 0xFF;
            hexChars[j * 2] = hexArray[v >>> 4];
            hexChars[j * 2 + 1] = hexArray[v & 0x0F];
        }
        return new String(hexChars);
    }

    public String convertHexToString(String hex) {
        StringBuilder sb = new StringBuilder();
        StringBuilder temp = new StringBuilder();
        for (int i = 0; i < hex.length() - 1; i += 2) {
            String output = hex.substring(i, (i + 2));
            int decimal = Integer.parseInt(output, 16);
            sb.append((char) decimal);
            temp.append(decimal);
        }
        System.out.println("Decimal : " + temp.toString());
        return sb.toString();
    }


    //*****************************************
    //* TESTING FUNCTIONS... IGNORE UNLESS YOU CARE
    //*****************************************

    private void add_to_map(String url, Integer rssi) {
        Log.i("MAP:", "ADDING");
        if (!rssi_bank.containsKey(url)) {
            ArrayList<Pair<Integer, Long>> empty_list = new ArrayList<Pair<Integer, Long>>();
            boolean test = true;
            Long time = System.currentTimeMillis();
            if (test) {
                time = time - 1000;
            }
            Pair<Integer, Long> new_packet_rssi = new Pair<Integer, Long>(rssi, time);
            empty_list.add(empty_list.size(), new_packet_rssi);
            Pair<Integer, ArrayList<Pair<Integer, Long>>> empty_values = new Pair<Integer, ArrayList<Pair<Integer, Long>>>(rssi, empty_list);
            //rssi_bank.put(url, empty_values);
        } else {
            //Pair<Integer, ArrayList<Pair<Integer, Long>>> cur_device = rssi_bank.get(url);
            //ArrayList<Pair<Integer, Long>> historical_values = cur_device.second;
            Pair<Integer, Long> new_packet = new Pair<Integer, Long>(rssi, System.currentTimeMillis());
            //historical_values.add(historical_values.size(), new_packet);
        }
    }


    private void update_map() {
        Log.i("MAP:", "UPDATING");
        Iterator it = rssi_bank.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry pairs = (Map.Entry) it.next();
            String url = (String) pairs.getKey();
            Pair<Integer, ArrayList<Pair<Integer, Long>>> cur_device = (Pair<Integer, ArrayList<Pair<Integer, Long>>>) pairs.getValue();
            Integer current_sum = cur_device.first;
            ArrayList<Pair<Integer, Long>> historical_values = cur_device.second;
            Log.i("MAP:", "ITERATOR");


            //Log.i("MAP: MAX", "MAX_VALID");

            //Log.i("MAP: HISTORICAL_VALUES, SIZE ", String.valueOf(historical_values.size()));
            for (int i = 0; i < historical_values.size(); i++) {
                Pair<Integer, Long> historical_beacon = historical_values.get(i);
                Long historical_time = historical_beacon.second;
                Integer historical_value = historical_beacon.first;
                Integer num_reports = historical_values.size();
                Integer cur_avg = current_sum / num_reports;

                Log.i("MAP: Historical_time", String.valueOf(historical_time));
                Log.i("MAP: Historical_value", String.valueOf(historical_value));
                Log.i("MAP: Num_reports", String.valueOf(num_reports));
                Log.i("MAP: CUR_AVG", String.valueOf(cur_avg));
                Log.i("MAP: delta_time", String.valueOf(System.currentTimeMillis() - historical_time));

                if (System.currentTimeMillis() - historical_time >= TIME_DECAY) { //timeout
                    Log.i("MAP: Decay", "POINT DECAYING");
                    if (cur_avg == CUR_MAX_AVG && CUR_MAX_AVG != -1) { //cover the case of the max timing out
                        Log.i("MAP: MAX TIMING OUT", "*********************");
                        Log.i("MAP: cur_avg", String.valueOf(cur_avg));
                        Log.i("MAP: CUR_MAX_AVG", String.valueOf(CUR_MAX_AVG));
                        break;
                    }
                    current_sum = current_sum - historical_value; //remove this from the sum
                    historical_values.remove(i);
                    Pair<Integer, ArrayList<Pair<Integer, Long>>> updated_value =
                            new Pair<Integer, ArrayList<Pair<Integer, Long>>>(current_sum, historical_values);

                } else {
                    //current_sum = current_sum + rssi;
                    Log.i("MAP: No Decay", "NO DECAY");

                    Integer new_avg = current_sum / num_reports;
                    Log.i("MAP: num_reports", String.valueOf(new_avg));
                    Log.i("MAP: new avg", String.valueOf(new_avg));
                    Log.i("MAP: CUR_MAX_AVG", String.valueOf(CUR_MAX_AVG));

                    if (new_avg > CUR_MAX_AVG) {
                        CUR_MAX_AVG = new_avg;
                        //CUR_URL = url;
                    }
                    Pair<Integer, Long> updated_pair = new Pair<Integer, Long>(current_sum, System.currentTimeMillis());
                    historical_values.remove(i);
                    historical_values.add(i, updated_pair);
                }
            }
        }
        it.remove(); // avoids a ConcurrentModificationException

    }

    private void map_to_string(HashMap<String, Pair<Integer, ArrayList<Pair<Integer, Long>>>> rssi_bank) {
        Log.w("                      MAP: PRINTING", "PRINTING");
        Iterator it = rssi_bank.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry pairs = (Map.Entry) it.next();
            String cur_url = (String) pairs.getKey();
            Pair<Integer, ArrayList<Pair<Integer, Long>>> cur_device = (Pair<Integer, ArrayList<Pair<Integer, Long>>>) pairs.getValue();
            Log.w("                      MAP:", cur_url);
            Log.w("                      MAP:SUM: ", String.valueOf(cur_device.first));
            ArrayList<Pair<Integer, Long>> cur_list = cur_device.second;
            for (int i = 0; i < cur_list.size(); i++) {
                Log.w("                      MAP:SUM:PAIR.first", String.valueOf(cur_list.get(i).first));
                Log.w("                      MAP:SUM:PAIR.second", String.valueOf(cur_list.get(i).second));
            }
        }
    }


    private void test_map(String url, Integer rssi) {
        add_to_map(url, rssi);
        update_map();
    }

}




/*
    //This is Noah's android implementation of a fast sliding window ordered list for RSSI... not sure if it works
    private void fast_sliding_window_max(Vector<Integer> arr, int K) {
        for (int i = 0; i < arr.size(); i++) {
            while (!window.isEmpty() && window.peekLast().first  <= arr.get(i)) {
                window.removeLast();
            }
            window.addLast(new Pair<Integer, Integer>(arr.get(i), i));
            while(window.peekFirst().second <= i - K)
                window.removeFirst();
            Log.i("SLIDING_WINDOW", String.valueOf(window.getFirst().first));
        }
    }

 */
