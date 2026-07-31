import { useState, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Klavye açık mı? — dikey ORTALANMIŞ formlar için.
 *
 * NEDEN VAR: Android klavye açılınca ekranı yeniden boyutlandırır
 * (adjustResize). `ScrollView` içinde `flexGrow: 1 + justifyContent: 'center'`
 * ile ortalanmış bir içerik, kap kısalınca YENİ yüksekliğe göre tekrar
 * ortalanır ve zıplar. Üstelik yazarken klavyenin öneri şeridi gelip gittikçe
 * yükseklik yine değişir, yani form tek sefer değil SÜREKLİ oynar.
 *
 * Çözüm: ortalamayı yalnız klavye kapalıyken uygula. Klavye açıkken içerik
 * yukarı sabitlenir; kap boyu değişse de içerik yerinde kalır, kaydırma zaten
 * ScrollView'de.
 *
 * Not: iOS'ta `keyboardWillShow` daha erken tetiklenir ve animasyonla uyumlu
 * olur; Android'de o olay yok, `keyboardDidShow` kullanılmalı.
 */
export default function useKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, () => setOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return open;
}
