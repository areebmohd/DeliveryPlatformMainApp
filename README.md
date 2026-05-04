# ZORO Delivery App 🚀

A comprehensive, high-performance delivery platform built with React Native. ZORO Delivery provides a seamless experience for both customers looking for quick deliveries and businesses managing their stores and orders in real-time.

---

## 🌟 Key Features

### 👤 Customer App
- **Intuitive Home Feed**: Personalized category browsing and trending stores.
- **Advanced Search**: Location-aware search for products and stores using Mappls SDK.
- **Seamless Cart Experience**: Multi-store cart management with real-time price calculations.
- **Smart Tracking**: Live order tracking with map integration.
- **Account Management**: Multiple address support, order history, and favorites.
- **Return System**: Easy-to-use return requests for delivered products.

### 💼 Business App
- **Dynamic Dashboard**: Real-time overview of orders, revenue, and store performance.
- **Inventory Management**: Effortlessly add, update, and manage products with high-quality image uploads.
- **Order Control**: Manage incoming orders, track payouts, and handle customer returns.
- **Promotion Tools**: Create and manage store-specific offers to boost sales.
- **Store Configuration**: Full control over store details, operation hours, and location.

---

<img width="1920" height="1080" alt="mainApp" src="https://github.com/user-attachments/assets/ef97867e-56cd-4ca3-a289-f4b7f959af45" />


## 🛠 Tech Stack

- **Frontend**: [React Native](https://reactnative.dev/) (TypeScript)
- **Backend & Database**: [Supabase](https://supabase.com/) (Real-time DB, Auth, Storage)
- **Maps & Location**: [Mappls SDK](https://www.mappls.com/) (formerly MapmyIndia)
- **Notifications**: [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging)
- **Camera & Scanning**: [React Native Vision Camera](https://mrousavy.com/react-native-vision-camera/)
- **UI & Animations**: React Native Linear Gradient, Vector Icons, Safe Area Context.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: >= 22.11.0
- **Android Studio** (for Android development)
- **Xcode** (for iOS development - macOS only)
- **Ruby & CocoaPods** (for iOS dependencies)

### Installation

1. **Clone the repository**:
   ```sh
   git clone <repository-url>
   cd mainApp
   ```

2. **Install dependencies**:
   ```sh
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add the following (refer to `.env.example`):
   ```env
   SUPABASE_URL=your_url
   SUPABASE_ANON_KEY=your_key
   MAP_SDK_KEY=your_key
   ...
   ```

4. **iOS Setup** (macOS only):
   ```sh
   cd ios && pod install && cd ..
   ```

### Running the App

1. **Start Metro Bundler**:
   ```sh
   npm start
   ```

2. **Run on Android**:
   ```sh
   npm run android
   ```

3. **Run on iOS**:
   ```sh
   npm run ios
   ```

---

## 📁 Project Structure

```text
src/
├── api/            # Supabase clients and API logic
├── components/     # Reusable UI components
├── context/        # React Context providers (Auth, Cart, etc.)
├── hooks/          # Custom React hooks
├── navigation/     # App routing and navigation stacks
├── screens/        # Screen components (Customer, Business, Auth)
├── theme/          # Global styles, colors, and typography
├── types/          # TypeScript interfaces and types
└── utils/          # Helper functions and constants
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is private and confidential.

---

<p align="center">
  Built with ❤️ by the ZORO Delivery Team
</p>
