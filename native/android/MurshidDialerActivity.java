package com.murshid.s7;

import android.app.Activity;
import android.app.NotificationManager;
import android.app.role.RoleManager;
import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.telecom.Call;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class MurshidDialerActivity extends Activity {
  private static volatile boolean callScreenVisible;
  public static final String ACTION_INCOMING = "com.murshid.s7.INCOMING_CALL";
  public static final String ACTION_ONGOING = "com.murshid.s7.ONGOING_CALL";
  public static final String ACTION_OPEN_DIALER = "com.murshid.s7.OPEN_DIALER";
  public static final String ACTION_ANSWER_FROM_NOTIFICATION = "com.murshid.s7.ANSWER_FROM_NOTIFICATION";
  public static final String EXTRA_CALLER_NAME = "caller_name";
  public static final String EXTRA_LINE_LABEL = "line_label";
  public static final String EXTRA_CONTACT_TYPE = "contact_type";
  public static final String EXTRA_SAVED_CONTACT = "saved_contact";
  public static final String EXTRA_FAVORITE_CONTACT = "favorite_contact";
  public static final String EXTRA_CONTACT_LOOKUP_AVAILABLE = "contact_lookup_available";
  public static final String EXTRA_VERIFIED = "verified";
  public static final String EXTRA_CONNECTED_AT = "connected_at";
  private int TEAL;
  private int INK;
  private int MUTED;
  private int PAPER;
  private int SURFACE;
  private int LINE;
  private int SOFT_TEAL;
  private int SOFT_CORAL;
  private boolean darkTheme;
  private static final int REQUEST_CONTACTS = 9201;
  private static final int REQUEST_DIALER_ROLE = 9202;
  private static final int REQUEST_CALL_PHONE = 9203;
  private static final int REQUEST_PHONE_STATE = 9204;
  private static final int REQUEST_POST_NOTIFICATIONS = 9205;
  private EditText numberInput;
  private PhoneAccountHandle selectedAccount;
  private float gestureStartX;
  private final Handler callTimerHandler = new Handler(Looper.getMainLooper());
  private long callStartedElapsed;
  private boolean muted;
  private boolean speakerEnabled;
  private TextView callDuration;
  private boolean callStateReceiverRegistered;
  private boolean refreshDialPadOnResume;
  private boolean overlayPermissionRequestPending;
  private static volatile boolean externalSettingsVisible;
  private Typeface ruqaaRegular;
  private Typeface ruqaaBold;
  private final Runnable callTimer = new Runnable() {
    @Override public void run() {
      if (callDuration != null) {
        long seconds = Math.max(0L, (SystemClock.elapsedRealtime() - callStartedElapsed) / 1000L);
        callDuration.setText(String.format(Locale.ROOT, "%02d:%02d:%02d", seconds / 3600, (seconds / 60) % 60, seconds % 60));
        callTimerHandler.postDelayed(this, 1000L);
      }
    }
  };
  private final BroadcastReceiver callStateReceiver = new BroadcastReceiver() {
    @Override public void onReceive(Context context, Intent intent) {
      int state = intent.getIntExtra(MurshidInCallService.EXTRA_CALL_STATE, Call.STATE_DISCONNECTED);
      if (state == Call.STATE_DISCONNECTED) {
        finish();
        return;
      }
      Intent updated = getIntent() == null ? new Intent(MurshidDialerActivity.this, MurshidDialerActivity.class) : new Intent(getIntent());
      updated.setAction(state == Call.STATE_RINGING ? ACTION_INCOMING : ACTION_ONGOING);
      updated.putExtra(EXTRA_CALLER_NAME, intent.getStringExtra(EXTRA_CALLER_NAME));
      updated.putExtra(EXTRA_LINE_LABEL, intent.getStringExtra(EXTRA_LINE_LABEL));
      updated.putExtra(EXTRA_CONTACT_TYPE, intent.getStringExtra(EXTRA_CONTACT_TYPE));
      updated.putExtra(EXTRA_SAVED_CONTACT, intent.getBooleanExtra(EXTRA_SAVED_CONTACT, false));
      updated.putExtra(EXTRA_FAVORITE_CONTACT, intent.getBooleanExtra(EXTRA_FAVORITE_CONTACT, false));
      updated.putExtra(EXTRA_CONTACT_LOOKUP_AVAILABLE, intent.getBooleanExtra(EXTRA_CONTACT_LOOKUP_AVAILABLE, false));
      updated.putExtra(EXTRA_VERIFIED, intent.getBooleanExtra(EXTRA_VERIFIED, false));
      setIntent(updated);
      renderCallScreen(state == Call.STATE_RINGING ? "اتصال وارد إلى مُرشد" : "مكالمة مُرشد جارية",
          state == Call.STATE_RINGING ? "اسحب للرد أو الرفض" : "المكالمة متصلة", state == Call.STATE_RINGING);
    }
  };

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    applyThemePalette();
    Window window = getWindow();
    window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
    render(getIntent());
  }

  private void applyThemePalette() {
    String mode = getSharedPreferences("murshid_theme", MODE_PRIVATE).getString("theme_mode", "light");
    darkTheme = "dark".equals(mode);
    if (darkTheme) {
      TEAL = Color.rgb(89, 198, 179);
      INK = Color.rgb(235, 244, 242);
      MUTED = Color.rgb(164, 184, 183);
      PAPER = Color.rgb(24, 39, 44);
      SURFACE = Color.rgb(12, 25, 30);
      LINE = Color.rgb(50, 72, 76);
      SOFT_TEAL = Color.rgb(38, 70, 69);
      SOFT_CORAL = Color.rgb(82, 49, 48);
    } else {
      TEAL = Color.rgb(10, 132, 120);
      INK = Color.rgb(16, 33, 43);
      MUTED = Color.rgb(92, 113, 119);
      PAPER = Color.rgb(255, 255, 255);
      SURFACE = Color.rgb(247, 250, 249);
      LINE = Color.rgb(214, 228, 224);
      SOFT_TEAL = Color.rgb(231, 244, 240);
      SOFT_CORAL = Color.rgb(255, 232, 220);
    }
  }

  @Override protected void onStart() {
    super.onStart();
    callScreenVisible = true;
    IntentFilter filter = new IntentFilter(MurshidInCallService.ACTION_CALL_STATE_CHANGED);
    if (Build.VERSION.SDK_INT >= 33) registerReceiver(callStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
    else registerReceiver(callStateReceiver, filter);
    callStateReceiverRegistered = true;
    MurshidInCallService.setCallScreenActivityVisible(true);
  }

  @Override protected void onResume() {
    super.onResume();
    externalSettingsVisible = false;
    if (overlayPermissionRequestPending) {
      overlayPermissionRequestPending = false;
      if (MurshidCallOverlay.hasPermission(this)) {
        MurshidCallOverlay.setEnabled(this, true);
        Toast.makeText(this, "تم السماح بالواجهة العائمة وتشغيلها", Toast.LENGTH_LONG).show();
      } else {
        Toast.makeText(this, "لم يُمنح إذن الظهور فوق التطبيقات؛ بقيت الواجهة العائمة متوقفة", Toast.LENGTH_LONG).show();
      }
      refreshDialPadOnResume = true;
    }
    if (refreshDialPadOnResume) {
      refreshDialPadOnResume = false;
      renderDialPad(numberInput == null ? "" : numberInput.getText().toString());
    }
  }

  @Override protected void onStop() {
    if (callStateReceiverRegistered) {
      unregisterReceiver(callStateReceiver);
      callStateReceiverRegistered = false;
    }
    callScreenVisible = false;
    if (!externalSettingsVisible) MurshidInCallService.setCallScreenActivityVisible(false);
    super.onStop();
  }

  public static boolean isCallScreenVisible() { return callScreenVisible; }
  public static boolean isExternalSettingsVisible() { return externalSettingsVisible; }

  @Override protected void onDestroy() {
    callTimerHandler.removeCallbacks(callTimer);
    callDuration = null;
    super.onDestroy();
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    render(intent);
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == REQUEST_DIALER_ROLE) {
      if (isDefaultDialer()) {
        Toast.makeText(this, "تم تفعيل واجهة مُرشد للمكالمات الواردة والصادرة", Toast.LENGTH_LONG).show();
        renderDialPad(numberInput == null ? "" : numberInput.getText().toString());
      } else {
        Toast.makeText(this, "بقي التطبيق الافتراضي كما هو؛ ما زالت لوحة مُرشد تتيح بدء المكالمات الصادرة", Toast.LENGTH_LONG).show();
      }
    }
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode == REQUEST_POST_NOTIFICATIONS || requestCode == REQUEST_PHONE_STATE) {
      renderDialPad(numberInput == null ? "" : numberInput.getText().toString());
    }
  }

  private void render(Intent intent) {
    String action = intent == null ? null : intent.getAction();
    if (ACTION_INCOMING.equals(action)) {
      renderCallScreen("اتصال وارد إلى مُرشد", "اسحب للرد أو الرفض", true);
    } else if (ACTION_ONGOING.equals(action)) {
      renderCallScreen("مكالمة مُرشد جارية", "المكالمة متصلة", false);
    } else if (ACTION_ANSWER_FROM_NOTIFICATION.equals(action)) {
      if (MurshidInCallService.dispatchAction(MurshidInCallService.ACTION_ANSWER, false)) {
        Intent ongoing = new Intent(intent);
        ongoing.setAction(ACTION_ONGOING);
        setIntent(ongoing);
        renderCallScreen("مكالمة مُرشد جارية", "تم الرد على المكالمة", false);
      } else {
        Toast.makeText(this, "لم تعد المكالمة الواردة نشطة", Toast.LENGTH_SHORT).show();
        renderCallScreen("اتصال وارد إلى مُرشد", "اسحب للرد أو الرفض", true);
      }
    } else {
      Uri data = intent == null ? null : intent.getData();
      renderDialPad(data == null ? "" : data.getSchemeSpecificPart());
    }
  }

  private void renderDialPad(String initialNumber) {
    restoreNormalWindowMode();
    ScrollView scroll = new ScrollView(this);
    scroll.setBackgroundColor(SURFACE);
    LinearLayout root = vertical(24, 28, 24, 36);

    LinearLayout header = horizontal();
    LinearLayout headerCopy = vertical(0, 0, 0, 0);
    headerCopy.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1));
    headerCopy.addView(label("MURSHID PHONE", 12, TEAL, Typeface.BOLD));
    headerCopy.addView(label("لوحة الاتصال", 30, INK, Typeface.BOLD));
    headerCopy.addView(label("لوحة مُرشد تعمل دون تعيينها افتراضيًا، مع اختيار شريحة الاتصال.", 14, MUTED, Typeface.NORMAL));
    header.addView(headerCopy);
    TextView icon = label("☎", 28, TEAL, Typeface.BOLD);
    icon.setGravity(Gravity.CENTER);
    icon.setBackground(round(TEAL, 20));
    LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(58), dp(58));
    iconParams.gravity = Gravity.TOP;
    header.addView(icon, iconParams);
    root.addView(header);

    LinearLayout numberCard = card();
    TextView numberLabel = label("رقم الهاتف", 12, MUTED, Typeface.BOLD);
    numberCard.addView(numberLabel);
    numberInput = new EditText(this);
    numberInput.setText(initialNumber);
    numberInput.setHint("اكتب الرقم هنا");
    numberInput.setHintTextColor(darkTheme ? Color.rgb(146, 165, 164) : Color.rgb(160, 177, 175));
    numberInput.setTextColor(INK);
    numberInput.setTextSize(26);
    numberInput.setTypeface(ruqaaRegular());
    numberInput.setGravity(Gravity.CENTER);
    numberInput.setSingleLine(true);
    numberInput.setInputType(android.text.InputType.TYPE_CLASS_PHONE);
    numberInput.setBackground(round(SURFACE, 18));
    numberCard.addView(numberInput, new LinearLayout.LayoutParams(-1, dp(68)));
    root.addView(numberCard, marginParams(0, 22, 0, 0));

    Button contactsButton = utilityButton("جهات الاتصال  ·  اختر اسمًا للاتصال");
    contactsButton.setOnClickListener(v -> renderContacts());
    root.addView(contactsButton, marginParams(0, 12, 0, 0));

    TextView simHeading = label("اختر الشريحة", 16, INK, Typeface.BOLD);
    root.addView(simHeading, marginParams(0, 20, 0, 8));
    LinearLayout simRow = horizontal();
    simRow.setGravity(Gravity.CENTER_VERTICAL);
    addSimAccounts(simRow);
    root.addView(simRow);

    TextView keypadHeading = label("لوحة الأرقام", 16, INK, Typeface.BOLD);
    root.addView(keypadHeading, marginParams(0, 20, 0, 8));
    GridLayout keypad = new GridLayout(this);
    keypad.setColumnCount(3);
    keypad.setUseDefaultMargins(false);
    String[] digits = {"1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"};
    for (String digit : digits) {
      Button key = keyButton(digit);
      key.setOnClickListener(v -> numberInput.append(digit));
      GridLayout.LayoutParams params = new GridLayout.LayoutParams();
      params.width = 0;
      params.height = dp(58);
      params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
      params.setMargins(dp(4), dp(4), dp(4), dp(4));
      keypad.addView(key, params);
    }
    root.addView(keypad);

    LinearLayout utilityRow = horizontal();
    Button clear = utilityButton("مسح الكل");
    clear.setOnClickListener(v -> numberInput.setText(""));
    Button backspace = utilityButton("⌫ حذف");
    backspace.setOnClickListener(v -> {
      int length = numberInput.length();
      if (length > 0) numberInput.getText().delete(length - 1, length);
    });
    utilityRow.addView(clear, new LinearLayout.LayoutParams(0, dp(44), 1));
    utilityRow.addView(backspace, new LinearLayout.LayoutParams(0, dp(44), 1));
    root.addView(utilityRow, marginParams(0, 6, 0, 0));

    Button call = new Button(this);
    call.setText("اتصال الآن  〉");
    call.setTextColor(PAPER);
    call.setTextSize(16);
    call.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    call.setAllCaps(false);
    call.setBackground(round(TEAL, 18));
    call.setOnClickListener(v -> placeCall());
    root.addView(call, marginParams(0, 20, 0, 0));

    if (!isDefaultDialer()) {
      Button roleButton = utilityButton("تفعيل واجهة مُرشد للمكالمات الواردة (اختياري)");
      roleButton.setOnClickListener(v -> requestDialerRole());
      root.addView(roleButton, marginParams(0, 12, 0, 0));
    }
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      Button notificationButton = utilityButton("السماح بإشعارات المكالمات الواردة");
      notificationButton.setOnClickListener(v -> requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST_POST_NOTIFICATIONS));
      root.addView(notificationButton, marginParams(0, 8, 0, 0));
    }
    if (Build.VERSION.SDK_INT >= 34 && !canUseFullScreenIntent()) {
      Button fullScreenButton = utilityButton("السماح بفتح شاشة المكالمة كاملة");
      fullScreenButton.setOnClickListener(v -> openFullScreenIntentSettings());
      root.addView(fullScreenButton, marginParams(0, 8, 0, 0));
    }
    if (!MurshidCallOverlay.hasPermission(this)) {
      Button overlayPermissionButton = utilityButton("السماح بالظهور فوق التطبيقات");
      overlayPermissionButton.setOnClickListener(v -> requestCallOverlayAccess());
      root.addView(overlayPermissionButton, marginParams(0, 10, 0, 0));
    } else {
      boolean overlayEnabled = MurshidCallOverlay.isEnabled(this);
      Button overlayToggle = utilityButton(overlayEnabled
          ? "إيقاف الواجهة العائمة للمكالمات" : "تفعيل الواجهة العائمة للمكالمات");
      overlayToggle.setOnClickListener(v -> toggleCallOverlay());
      root.addView(overlayToggle, marginParams(0, 10, 0, 0));
    }
    TextView overlayHint = label("تظهر شاشة المكالمة بملء الشاشة عند ورود اتصال. إذن الظهور فوق التطبيقات يسمح بعرضها فوق التطبيق الحالي، ويمكن إيقاف الطبقة من هنا.", 11, MUTED, Typeface.NORMAL);
    overlayHint.setGravity(Gravity.CENTER);
    root.addView(overlayHint, marginParams(0, 5, 0, 0));

    TextView hint = label("الاتصال الصادر من مُرشد لا يتطلب جعله افتراضيًا. استقبال المكالمات الواردة عبر مُرشد يتطلب دور تطبيق الهاتف الافتراضي.", 12, MUTED, Typeface.NORMAL);
    hint.setGravity(Gravity.CENTER);
    root.addView(hint, marginParams(0, 12, 0, 0));
    scroll.addView(root);
    setContentView(scroll);
  }

  private void addSimAccounts(LinearLayout row) {
    if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
      Button permission = utilityButton("السماح بعرض شرائح SIM");
      permission.setOnClickListener(v -> requestPermissions(new String[] { Manifest.permission.READ_PHONE_STATE }, REQUEST_PHONE_STATE));
      row.addView(permission, new LinearLayout.LayoutParams(-1, dp(48)));
      return;
    }
    TelecomManager telecom = (TelecomManager) getSystemService(Context.TELECOM_SERVICE);
    List<PhoneAccountHandle> accounts = null;
    try { accounts = telecom.getCallCapablePhoneAccounts(); } catch (SecurityException ignored) { }
    if (accounts == null || accounts.isEmpty()) {
      Button unavailable = utilityButton("الشريحة الافتراضية");
      unavailable.setText("الشريحة الافتراضية");
      row.addView(unavailable, new LinearLayout.LayoutParams(-1, dp(48)));
      return;
    }
    for (int i = 0; i < accounts.size(); i++) {
      PhoneAccountHandle account = accounts.get(i);
      String label = "SIM " + (i + 1);
      try {
        CharSequence accountLabel = telecom.getPhoneAccount(account).getLabel();
        if (accountLabel != null && accountLabel.length() > 0) label = accountLabel.toString();
      } catch (Exception ignored) { }
      Button sim = utilityButton(label);
      if (selectedAccount == null) selectedAccount = account;
      boolean selected = selectedAccount != null && selectedAccount.equals(account);
      sim.setText((selected ? "✓ " : "") + label);
      sim.setTag(account);
      sim.setOnClickListener(v -> {
        selectedAccount = (PhoneAccountHandle) v.getTag();
        renderDialPad(numberInput == null ? "" : numberInput.getText().toString());
      });
      LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(48), 1);
      params.setMargins(dp(4), 0, dp(4), 0);
      row.addView(sim, params);
    }
  }

  private void renderCallScreen(String titleText, String detailText, boolean incoming) {
    callTimerHandler.removeCallbacks(callTimer);
    String callerName = getIntent().getStringExtra(EXTRA_CALLER_NAME);
    String line = getIntent().getStringExtra(EXTRA_LINE_LABEL);
    String contactType = getIntent().getStringExtra(EXTRA_CONTACT_TYPE);
    boolean savedContact = getIntent().getBooleanExtra(EXTRA_SAVED_CONTACT, false);
    boolean favoriteContact = getIntent().getBooleanExtra(EXTRA_FAVORITE_CONTACT, false);
    boolean contactLookupAvailable = getIntent().getBooleanExtra(EXTRA_CONTACT_LOOKUP_AVAILABLE, false);
    boolean verified = getIntent().getBooleanExtra(EXTRA_VERIFIED, false);
    Uri callUri = getIntent() == null ? null : getIntent().getData();
    String callerNumber = callUri == null ? "" : callUri.getSchemeSpecificPart();
    Window window = getWindow();
    window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    window.setStatusBarColor(Color.rgb(9, 8, 9));
    window.setNavigationBarColor(Color.rgb(9, 8, 9));
    if (Build.VERSION.SDK_INT >= 19) {
      window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }
    setContentView(new MurshidCallScreenView(this, callerName, callerNumber, line, contactType,
        savedContact, favoriteContact, contactLookupAvailable, verified, incoming));
  }

  private void sendCallControl(String action, boolean enabled) {
    if (!MurshidInCallService.dispatchAction(action, enabled)) {
      Toast.makeText(this, "تعذر التحكم بالمكالمة؛ أعد فتح شاشة الاتصال", Toast.LENGTH_SHORT).show();
    }
  }

  private LinearLayout brandHeader() {
    LinearLayout header = vertical(0, 0, 0, 0);
    header.setGravity(Gravity.CENTER);
    ImageView logo = new ImageView(this);
    logo.setImageResource(com.murshid.s7.R.mipmap.ic_launcher);
    logo.setBackground(round(Color.WHITE, 18));
    header.addView(logo, new LinearLayout.LayoutParams(dp(54), dp(54)));
    TextView brand = label("مُرشد", 25, Color.WHITE, Typeface.BOLD);
    brand.setGravity(Gravity.CENTER);
    header.addView(brand, marginParams(0, 7, 0, 0));
    TextView caption = label("اتصال آمن وواضح", 12, Color.rgb(202, 239, 233), Typeface.NORMAL);
    caption.setGravity(Gravity.CENTER);
    header.addView(caption, marginParams(0, 2, 0, 0));
    return header;
  }

  private void restoreNormalWindowMode() {
    Window window = getWindow();
    window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    if (Build.VERSION.SDK_INT >= 19) window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
  }

  private void renderContacts() {
    restoreNormalWindowMode();
    if (checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(new String[] { Manifest.permission.READ_CONTACTS }, REQUEST_CONTACTS);
      return;
    }
    ScrollView scroll = new ScrollView(this);
    scroll.setBackgroundColor(SURFACE);
    LinearLayout root = vertical(22, 24, 22, 28);
    root.addView(label("MURSHID CONTACTS", 12, TEAL, Typeface.BOLD));
    root.addView(label("جهات الاتصال", 28, INK, Typeface.BOLD), marginParams(0, 4, 0, 0));
    root.addView(label("جهات الهاتف وجهات ADN المقروءة مباشرة من شرائح SIM المتاحة.", 13, MUTED, Typeface.NORMAL), marginParams(0, 4, 0, 12));
    Button back = utilityButton("العودة إلى لوحة الاتصال");
    back.setOnClickListener(v -> renderDialPad(numberInput == null ? "" : numberInput.getText().toString()));
    root.addView(back);
    EditText search = new EditText(this);
    search.setSingleLine(true);
    search.setHint("ابحث بالاسم أو الرقم");
    search.setTextSize(16);
    search.setTextColor(INK);
    search.setBackground(round(PAPER, 16));
    root.addView(search, marginParams(0, 14, 0, 12));
    LinearLayout rows = vertical(0, 0, 0, 0);
    root.addView(rows);
    scroll.addView(root);
    setContentView(scroll);

    List<String[]> contacts = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    String[] projection = {
      ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
      ContactsContract.CommonDataKinds.Phone.NUMBER
    };
    try (Cursor cursor = getContentResolver().query(
        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
        projection,
        ContactsContract.CommonDataKinds.Phone.NUMBER + " IS NOT NULL",
        null,
        ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " COLLATE LOCALIZED ASC")) {
      if (cursor != null) {
        int nameColumn = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
        int numberColumn = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
        while (cursor.moveToNext()) {
          String name = nameColumn < 0 ? "" : cursor.getString(nameColumn);
          String number = numberColumn < 0 ? "" : cursor.getString(numberColumn);
          if (number == null || number.trim().isEmpty()) continue;
          String key = MurshidCallerInfo.normalize(number);
          if (!seen.add(key)) continue;
          contacts.add(new String[] { name == null || name.trim().isEmpty() ? "بدون اسم" : name, number, "جهات الهاتف" });
        }
      }
    } catch (SecurityException error) {
      Toast.makeText(this, "اسمح لمُرشد بقراءة جهات الاتصال لعرضها", Toast.LENGTH_LONG).show();
      return;
    }
    Map<String, Integer> contactIndexes = new HashMap<>();
    for (int i = 0; i < contacts.size(); i++) contactIndexes.put(MurshidCallerInfo.normalize(contacts.get(i)[1]), i);
    if (Build.VERSION.SDK_INT >= 31) loadDirectSimContacts(contacts, contactIndexes);
    TextView empty = label("لا توجد جهات اتصال بأرقام هاتف على الجهاز.", 14, MUTED, Typeface.NORMAL);
    empty.setGravity(Gravity.CENTER);
    root.addView(empty, marginParams(0, 16, 0, 0));
    Runnable refreshRows = () -> {
      rows.removeAllViews();
      String filter = search.getText().toString().trim().toLowerCase(Locale.ROOT);
      int count = 0;
      for (String[] contact : contacts) {
        if (!filter.isEmpty() && !contact[0].toLowerCase(Locale.ROOT).contains(filter) && !contact[1].toLowerCase(Locale.ROOT).contains(filter)) continue;
        LinearLayout item = vertical(16, 12, 16, 12);
        item.setBackground(round(PAPER, 16));
        TextView name = label(contact[0], 16, INK, Typeface.BOLD);
        TextView phone = label(contact[1], 14, MUTED, Typeface.NORMAL);
        item.addView(name);
        item.addView(phone, marginParams(0, 4, 0, 0));
        if (contact.length > 2 && contact[2] != null && !contact[2].isEmpty()) {
          item.addView(label(contact[2], 11, TEAL, Typeface.BOLD), marginParams(0, 5, 0, 0));
        }
        item.setOnClickListener(v -> {
          renderDialPad(contact[1]);
          numberInput.setText(contact[1]);
          numberInput.setSelection(numberInput.length());
        });
        rows.addView(item, marginParams(0, 0, 0, 8));
        count++;
      }
      empty.setVisibility(count == 0 ? View.VISIBLE : View.GONE);
      empty.setText(contacts.isEmpty() ? "لا توجد جهات اتصال بأرقام هاتف على الجهاز." : "لا توجد نتائج مطابقة.");
    };
    root.removeView(empty);
    root.addView(empty, marginParams(0, 12, 0, 0));
    search.addTextChangedListener(new TextWatcher() {
      @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
      @Override public void onTextChanged(CharSequence s, int start, int before, int count) { refreshRows.run(); }
      @Override public void afterTextChanged(Editable s) { }
    });
    refreshRows.run();
  }

  private void loadDirectSimContacts(List<String[]> contacts, Map<String, Integer> contactIndexes) {
    try {
      List<ContactsContract.SimAccount> simAccounts = ContactsContract.SimContacts.getSimAccounts(getContentResolver());
      for (ContactsContract.SimAccount simAccount : simAccounts) {
        if (simAccount.getEfType() != ContactsContract.SimAccount.ADN_EF_TYPE) continue;
        String accountName = simAccount.getAccountName();
        String accountType = simAccount.getAccountType();
        int slotIndex = simAccount.getSimSlotIndex();
        String simLabel = slotIndex >= 0 ? "SIM " + (slotIndex + 1) : "SIM";
        List<Long> rawContactIds = new ArrayList<>();
        try (Cursor rawCursor = getContentResolver().query(
            ContactsContract.RawContacts.CONTENT_URI,
            new String[] { ContactsContract.RawContacts._ID },
            ContactsContract.RawContacts.ACCOUNT_NAME + "=? AND " + ContactsContract.RawContacts.ACCOUNT_TYPE + "=? AND " + ContactsContract.RawContacts.DELETED + "=0",
            new String[] { accountName, accountType },
            ContactsContract.RawContacts._ID + " ASC")) {
          if (rawCursor != null) while (rawCursor.moveToNext()) rawContactIds.add(rawCursor.getLong(0));
        }
        if (rawContactIds.isEmpty()) continue;

        StringBuilder placeholders = new StringBuilder();
        List<String> dataArgs = new ArrayList<>();
        for (Long rawId : rawContactIds) {
          if (placeholders.length() > 0) placeholders.append(',');
          placeholders.append('?');
          dataArgs.add(String.valueOf(rawId));
        }
        placeholders.append(") AND (" + ContactsContract.Data.MIMETYPE + "=? OR " + ContactsContract.Data.MIMETYPE + "=?)");
        dataArgs.add(ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE);
        dataArgs.add(ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE);
        String selection = ContactsContract.Data.RAW_CONTACT_ID + " IN (" + placeholders;
        Map<Long, String> namesByRawId = new HashMap<>();
        Map<Long, List<String>> numbersByRawId = new HashMap<>();
        try (Cursor dataCursor = getContentResolver().query(
            ContactsContract.Data.CONTENT_URI,
            new String[] { ContactsContract.Data.RAW_CONTACT_ID, ContactsContract.Data.MIMETYPE, ContactsContract.Data.DATA1 },
            selection,
            dataArgs.toArray(new String[0]),
            ContactsContract.Data.RAW_CONTACT_ID + " ASC")) {
          if (dataCursor != null) {
            while (dataCursor.moveToNext()) {
              long rawId = dataCursor.getLong(0);
              String mimeType = dataCursor.getString(1);
              String value = dataCursor.getString(2);
              if (value == null || value.trim().isEmpty()) continue;
              if (ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE.equals(mimeType)) {
                namesByRawId.put(rawId, value);
              } else if (ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE.equals(mimeType)) {
                numbersByRawId.computeIfAbsent(rawId, ignored -> new ArrayList<>()).add(value);
              }
            }
          }
        }
        for (Map.Entry<Long, List<String>> entry : numbersByRawId.entrySet()) {
          String name = namesByRawId.get(entry.getKey());
          if (name == null || name.trim().isEmpty()) name = "بدون اسم";
          for (String number : entry.getValue()) {
            String normalized = MurshidCallerInfo.normalize(number);
            Integer existingIndex = contactIndexes.get(normalized);
            if (existingIndex != null) {
              String oldSource = contacts.get(existingIndex)[2];
              if (!oldSource.contains(simLabel)) contacts.get(existingIndex)[2] = oldSource + " · " + simLabel;
            } else {
              contactIndexes.put(normalized, contacts.size());
              contacts.add(new String[] { name, number, simLabel });
            }
          }
        }
      }
    } catch (SecurityException | IllegalArgumentException error) {
      Toast.makeText(this, "تعذر قراءة سجل SIM مباشرة على هذا الجهاز؛ ستظل جهات الهاتف المتاحة ظاهرة", Toast.LENGTH_LONG).show();
    }
  }

  private boolean isDefaultDialer() {
    if (Build.VERSION.SDK_INT >= 29) {
      RoleManager roleManager = getSystemService(RoleManager.class);
      return roleManager != null && roleManager.isRoleHeld(RoleManager.ROLE_DIALER);
    }
    TelecomManager telecom = (TelecomManager) getSystemService(Context.TELECOM_SERVICE);
    return telecom != null && getPackageName().equals(telecom.getDefaultDialerPackage());
  }

  private void requestDialerRole() {
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        RoleManager roleManager = getSystemService(RoleManager.class);
        if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) {
          startActivityForResult(roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER), REQUEST_DIALER_ROLE);
          return;
        }
      }
      Intent intent = new Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER);
      intent.putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, getPackageName());
      startActivityForResult(intent, REQUEST_DIALER_ROLE);
    } catch (Exception error) {
      Toast.makeText(this, "افتح إعدادات التطبيقات الافتراضية واختر مُرشد لتطبيق الهاتف", Toast.LENGTH_LONG).show();
    }
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode == REQUEST_CONTACTS) {
      if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) renderContacts();
      else Toast.makeText(this, "يلزم السماح بجهات الاتصال لعرض الأسماء والأرقام", Toast.LENGTH_LONG).show();
    } else if (requestCode == REQUEST_PHONE_STATE) {
      if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) renderDialPad(numberInput == null ? "" : numberInput.getText().toString());
      else Toast.makeText(this, "يلزم السماح بحالة الهاتف لعرض شرائح SIM", Toast.LENGTH_LONG).show();
    } else if (requestCode == REQUEST_CALL_PHONE) {
      if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) placeCall();
      else Toast.makeText(this, "يلزم السماح بإجراء المكالمات للاتصال من مُرشد", Toast.LENGTH_LONG).show();
    } else if (requestCode == REQUEST_POST_NOTIFICATIONS) {
      if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) renderDialPad(numberInput == null ? "" : numberInput.getText().toString());
      else Toast.makeText(this, "فعّل إشعارات مُرشد من إعدادات Android لظهور المكالمات الواردة", Toast.LENGTH_LONG).show();
    }
  }

  private void placeCall() {
    String number = numberInput == null ? "" : numberInput.getText().toString().trim();
    if (number.isEmpty()) { Toast.makeText(this, "اكتب رقمًا أولًا", Toast.LENGTH_SHORT).show(); return; }
    if (checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(new String[] { Manifest.permission.CALL_PHONE }, REQUEST_CALL_PHONE);
      return;
    }
    try {
      TelecomManager telecom = (TelecomManager) getSystemService(Context.TELECOM_SERVICE);
      Bundle extras = new Bundle();
      if (selectedAccount != null) extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, selectedAccount);
      telecom.placeCall(Uri.parse("tel:" + Uri.encode(number)), extras);
    } catch (SecurityException error) {
      Toast.makeText(this, "تعذر بدء المكالمة؛ تحقق من صلاحية الاتصال واختيار الشريحة", Toast.LENGTH_LONG).show();
    }
  }

  private void sendCallAction(String action) {
    if (!MurshidInCallService.dispatchAction(action, false)) {
      Toast.makeText(this, "المكالمة لم تعد نشطة", Toast.LENGTH_SHORT).show();
      finish();
      return;
    }
    if (MurshidInCallService.ACTION_ANSWER.equals(action)) {
      Intent ongoing = getIntent() == null ? new Intent(this, MurshidDialerActivity.class) : new Intent(getIntent());
      ongoing.setAction(ACTION_ONGOING);
      setIntent(ongoing);
      renderCallScreen("مكالمة مُرشد جارية", "تم الرد على المكالمة", false);
    } else {
      finish();
    }
  }

  private boolean canUseFullScreenIntent() {
    if (Build.VERSION.SDK_INT < 34) return true;
    NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    return manager != null && manager.canUseFullScreenIntent();
  }

  private void openFullScreenIntentSettings() {
    if (Build.VERSION.SDK_INT < 34 || canUseFullScreenIntent()) return;
    try {
      externalSettingsVisible = true;
      MurshidInCallService.setCallScreenActivityVisible(true);
      refreshDialPadOnResume = true;
      Intent settings = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
          Uri.parse("package:" + getPackageName()));
      startActivity(settings);
    } catch (RuntimeException error) {
      externalSettingsVisible = false;
      Toast.makeText(this, "افتح إعدادات مُرشد ثم فعّل إذن الإشعارات بملء الشاشة", Toast.LENGTH_LONG).show();
    }
  }

  private void requestCallOverlayAccess() {
    if (MurshidCallOverlay.hasPermission(this)) {
      toggleCallOverlay();
      return;
    }
    try {
      overlayPermissionRequestPending = true;
      externalSettingsVisible = true;
      MurshidInCallService.setCallScreenActivityVisible(true);
      refreshDialPadOnResume = true;
      Intent settings = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:" + getPackageName()));
      startActivity(settings);
    } catch (RuntimeException error) {
      overlayPermissionRequestPending = false;
      externalSettingsVisible = false;
      refreshDialPadOnResume = false;
      Toast.makeText(this, "تعذر فتح إعداد إذن الظهور فوق التطبيقات", Toast.LENGTH_LONG).show();
    }
  }

  private void toggleCallOverlay() {
    boolean enabled = !MurshidCallOverlay.isEnabled(this);
    MurshidCallOverlay.setEnabled(this, enabled);
    Toast.makeText(this, enabled ? "تم تفعيل الواجهة العائمة للمكالمات" : "تم إيقاف الواجهة العائمة للمكالمات", Toast.LENGTH_SHORT).show();
    renderDialPad(numberInput == null ? "" : numberInput.getText().toString());
  }

  private Button keyButton(String text) {
    Button button = new Button(this);
    button.setText(text);
    button.setTextSize(20);
    button.setTextColor(INK);
    button.setTypeface(ruqaaBold());
    button.setAllCaps(false);
    button.setBackground(round(PAPER, 18));
    return button;
  }

  private Button utilityButton(String text) {
    Button button = new Button(this);
    button.setText(text);
    button.setTextColor(TEAL);
    button.setTextSize(13);
    button.setTypeface(ruqaaBold());
    button.setAllCaps(false);
    button.setBackground(round(SOFT_TEAL, 16));
    return button;
  }

  private Button actionButton(String text, int color) {
    Button button = new Button(this);
    button.setText(text);
    button.setTextColor(PAPER);
    button.setTextSize(15);
    button.setTypeface(ruqaaBold());
    button.setAllCaps(false);
    button.setBackground(round(color, 18));
    return button;
  }

  private LinearLayout card() {
    LinearLayout view = vertical(18, 18, 18, 18);
    view.setBackground(round(PAPER, 24));
    return view;
  }

  private LinearLayout vertical(int left, int top, int right, int bottom) {
    LinearLayout view = new LinearLayout(this);
    view.setOrientation(LinearLayout.VERTICAL);
    view.setPadding(dp(left), dp(top), dp(right), dp(bottom));
    return view;
  }

  private LinearLayout horizontal() { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.HORIZONTAL); return view; }

  private TextView label(String text, int size, int color, int style) { TextView view = new TextView(this); view.setText(text); view.setTextSize(size); view.setTextColor(color); view.setTypeface(style == Typeface.BOLD ? ruqaaBold() : ruqaaRegular()); return view; }

  private Typeface ruqaaRegular() {
    if (ruqaaRegular == null) {
      try { ruqaaRegular = Typeface.createFromAsset(getAssets(), "fonts/ArefRuqaa-Regular.ttf"); }
      catch (RuntimeException ignored) { ruqaaRegular = Typeface.DEFAULT; }
    }
    return ruqaaRegular;
  }

  private Typeface ruqaaBold() {
    if (ruqaaBold == null) {
      try { ruqaaBold = Typeface.createFromAsset(getAssets(), "fonts/ArefRuqaa-Bold.ttf"); }
      catch (RuntimeException ignored) { ruqaaBold = Typeface.DEFAULT_BOLD; }
    }
    return ruqaaBold;
  }

  private GradientDrawable round(int color, int radius) { GradientDrawable drawable = new GradientDrawable(); drawable.setColor(color); drawable.setCornerRadius(dp(radius)); return drawable; }

  private LinearLayout.LayoutParams marginParams(int left, int top, int right, int bottom) { LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2); params.setMargins(dp(left), dp(top), dp(right), dp(bottom)); return params; }

  private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
