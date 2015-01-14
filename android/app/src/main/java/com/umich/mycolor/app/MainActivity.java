package com.umich.mycolor.app;

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.util.Pair;
import android.view.View;
import android.widget.Button;
import android.widget.Toast;
import com.larswerkman.holocolorpicker.ColorPicker;
import org.apache.http.HttpResponse;
import org.apache.http.NameValuePair;
import org.apache.http.client.HttpClient;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.message.BasicNameValuePair;

import java.util.*;

public class MainActivity extends Activity implements ColorPicker.OnColorChangedListener {
    private ColorPicker colorPicker;
    private Button setColorBTN;
    private BluetoothAdapter mBluetoothAdapter;
    private int REQUEST_ENABLE_BT = 1;

    private boolean ble_debug = true;
    private boolean color_debug = false;
    private boolean max_debug = false;


    private HashMap<String, Pair<Integer, ArrayList<Pair<Integer, Long>>>> rssi_bank; //used for the rssi max stuff
    int maxCalcDelayMS = 10000; //milliseconds
    String cur_url = "";
    Handler h;

    private String COLOR_HEX = "0x000000";

    private Integer TIME_DECAY = 10000;
    private Integer CUR_MAX_AVG = -1;
    private String CUR_URL = "";

    private String UNIQUE_ID = "BB12";
    private String ADDRESS_STR = "CC:2A:60:76:21:A9";

    private Integer RSSI_THRESH = 40;

    private String CUR_LIGHT = "";


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
            rssi_bank.put(url, empty_values);
        } else {
            Pair<Integer, ArrayList<Pair<Integer, Long>>> cur_device = rssi_bank.get(url);
            ArrayList<Pair<Integer, Long>> historical_values = cur_device.second;
            Pair<Integer, Long> new_packet = new Pair<Integer, Long>(rssi, System.currentTimeMillis());
            historical_values.add(historical_values.size(), new_packet);
        }
    }

    private void update_map() {
        Log.i("MAP:", "UPDATING");
        Iterator it = rssi_bank.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry pairs = (Map.Entry)it.next();
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
                    Integer cur_avg = current_sum/num_reports;

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
                            CUR_URL = url;
                        }
                        Pair<Integer, Long> updated_pair = new Pair<Integer, Long>(current_sum, System.currentTimeMillis());
                        historical_values.remove(i);
                        historical_values.add(i, updated_pair);
                    }
                }
            }
            it.remove(); // avoids a ConcurrentModificationException

    }


    private void test_map(String url, Integer rssi) {
        add_to_map(url, rssi);
        update_map();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        Log.e("MAP", "PRINTING");


        rssi_bank = new HashMap<String, Pair<Integer, ArrayList<Pair<Integer,Long>>>>();

        //test_map("A", 10);
        //test_map("A", 90);
        //map_to_string(rssi_bank);


        setup_ble();
        setup_gui();

        //h = new Handler();

        // This spawns the thread that periodically checks for the current max RSSI device
        // everything else is done with the BLE Callback
        //init_rssi_max_calculator();

    }

    final protected static char[] hexArray = "0123456789ABCDEF".toCharArray();
    public static String bytesToHex(byte[] bytes) {
        char[] hexChars = new char[bytes.length * 2];
        for ( int j = 0; j < bytes.length; j++ ) {
            int v = bytes[j] & 0xFF;
            hexChars[j * 2] = hexArray[v >>> 4];
            hexChars[j * 2 + 1] = hexArray[v & 0x0F];
        }
        return new String(hexChars);
    }

    public String convertHexToString(String hex){

        StringBuilder sb = new StringBuilder();
        StringBuilder temp = new StringBuilder();

        //49204c6f7665204a617661 split into two characters 49, 20, 4c...
        for( int i=0; i<hex.length()-1; i+=2 ){

            //grab the hex in pairs
            String output = hex.substring(i, (i + 2));
            //convert hex to decimal
            int decimal = Integer.parseInt(output, 16);
            //convert the decimal to character
            sb.append((char)decimal);

            temp.append(decimal);
        }
        System.out.println("Decimal : " + temp.toString());

        return sb.toString();
    }

    private void show_toast(String msg){
        Context context = this.getApplicationContext();
        CharSequence text = msg;
        int duration = Toast.LENGTH_SHORT;
        Toast toast = Toast.makeText(context, text, duration);
        toast.show();
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
                        String hex_size = byte_str.substring(index-4, index-2);
                        Integer dec_size = Integer.parseInt(hex_size, 16)-3;
                        String data = byte_str.substring(index + 4, index + 4 + (dec_size * 2));
                        String url = convertHexToString(data);
                        if (ble_debug) {
                            //Log.i("BLE:HIT", "##################");
                            //Log.i("BLE: RRSI", String.valueOf(rssi));
                            //Log.i("BLE: INDEX", String.valueOf(index));
                            //Log.i("BLE: HEX_SIZE", hex_size);
                            //Log.i("BLE: SIZE", String.valueOf(dec_size));
                            //Log.i("BLE: DATA", data);
                            //Log.i("BLE: URL", url);
                            if (rssi >= -60) {
                                //show_toast(url);
                                if (!CUR_LIGHT.equals(url)) {
                                    Log.i("BLE: URL", url);
                                    CUR_LIGHT = url;
                                    int color = colorPicker.getColor();
                                    COLOR_HEX = Integer.toHexString(color);
                                    Log.i("BLE: COLOR", COLOR_HEX);
                                    post(url);
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


    private void update_rssi(String url, int rssi) {
        //TODO handle key not found
        if (!rssi_bank.containsKey(url)) {
            ArrayList<Pair<Integer, Long>> empty_list = new ArrayList<Pair<Integer, Long>>();
            Pair<Integer, Long> new_packet_rssi = new Pair<Integer, Long>(rssi, System.currentTimeMillis());
            empty_list.add(empty_list.size(), new_packet_rssi);
            Pair<Integer, ArrayList<Pair<Integer, Long>>> empty_values = new Pair<Integer, ArrayList<Pair<Integer, Long>>>(rssi, empty_list);
            rssi_bank.put(url, empty_values);
        } else {
            Pair<Integer, ArrayList<Pair<Integer, Long>>> cur_device = rssi_bank.get(url);
            ArrayList<Pair<Integer, Long>> historical_values = cur_device.second;
            Pair<Integer, Long> new_packet = new Pair<Integer, Long>(rssi, System.currentTimeMillis());
            historical_values.add(historical_values.size(), new_packet);
        }
    }

    private void update_max() {
        //Sigh... digging in... get the devices associated with the url
        //Pair<Integer, ArrayList<Pair<Integer, Long>>> cur_device = rssi_bank.get(url);

        Iterator it = rssi_bank.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry pairs = (Map.Entry)it.next();
            String url = (String) pairs.getKey();
            Pair<Integer, ArrayList<Pair<Integer, Long>>> cur_device = (Pair<Integer, ArrayList<Pair<Integer, Long>>>) pairs.getValue();
            Integer current_sum = cur_device.first;
            ArrayList<Pair<Integer, Long>> historical_values = cur_device.second;

            boolean maxValid = true;
            while (maxValid == true) { //this is to get around the case of the max changing due to timeout
                for (int i = 0; i < historical_values.size(); i++) {
                    Pair<Integer, Long> historical_beacon = historical_values.get(i);
                    Long historical_time = historical_beacon.second;
                    Integer historical_value = historical_beacon.first;
                    Integer num_reports = historical_values.size();
                    Integer cur_avg = current_sum/num_reports; if (System.currentTimeMillis() - historical_time >= TIME_DECAY) { //timeout
                        if (cur_avg == CUR_MAX_AVG) { //cover the case of the max timing out
                            maxValid = false;
                            continue;
                        }
                        current_sum = current_sum - historical_value; //remove this from the sum
                        historical_values.remove(i);
                        Pair<Integer, ArrayList<Pair<Integer, Long>>> updated_value =
                                new Pair<Integer, ArrayList<Pair<Integer, Long>>>(current_sum, historical_values);

                    } else {
                        //current_sum = current_sum + rssi;
                        Integer new_avg = current_sum / num_reports;
                        if (new_avg > CUR_MAX_AVG) {
                            CUR_MAX_AVG = new_avg;
                            CUR_URL = url;
                        }
                        Pair<Integer, Long> updated_pair = new Pair<Integer, Long>(current_sum, System.currentTimeMillis());
                        historical_values.remove(i);
                        historical_values.add(i, updated_pair);
                    }
                    maxValid = true;
                }
            }
            it.remove(); // avoids a ConcurrentModificationException
        }
    }

    //Name, Pair(current_sum, List<historical_value, historical_time>) data structure...
    private void parse(BluetoothDevice device, int rssi) {
        String url = "";
        update_rssi(url, rssi);
    }

    private void post(String url) {
        HttpClient client = new DefaultHttpClient();
        HttpPost post = new HttpPost(url);
        List<NameValuePair> pairs = new ArrayList<NameValuePair>();
        pairs.add(new BasicNameValuePair("color_hex", COLOR_HEX));
        try {
            post.setEntity(new UrlEncodedFormEntity(pairs));
            HttpResponse response = client.execute(post);
        } catch (java.io.UnsupportedEncodingException e) {
            e.printStackTrace();
        } catch (java.io.IOException e) {
            e.printStackTrace();
        }
    }



    //*****************************************
    //* INIT FUNCTIONS
    //*****************************************
    private void init_rssi_max_calculator() {
        h.postDelayed(new Runnable(){
            public void run(){
                //do something
                if (max_debug) {
                    Log.i("MAX", "hb");
                }
                update_max();
                //post();
                h.postDelayed(this, maxCalcDelayMS);
            }
        }, maxCalcDelayMS);
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
        setColorBTN = (Button) findViewById(R.id.setColorBTN);
        colorPicker.setOnColorChangedListener(this);

        setColorBTN.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                int color = colorPicker.getColor();
                COLOR_HEX = Integer.toHexString(color);
                if (color_debug) {
                    Log.i("COLOR:textColor", "test");
                }
                colorPicker.setOldCenterColor(colorPicker.getColor());
            }
        });
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