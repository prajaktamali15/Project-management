<?php
session_start();

if (!isset($_SESSION['cart'])) {
    $_SESSION['cart'] = array();
}

if (isset($_GET['add'])) {
    $productId = $_GET['add'];
    if (!isset($_SESSION['cart'][$productId])) {
        $_SESSION['cart'][$productId] = 1;
    } else {
        $_SESSION['cart'][$productId]++;
    }
    header("Location: cart.php");
    exit();
}

if (isset($_GET['remove'])) {
    $productId = $_GET['remove'];
    if (isset($_SESSION['cart'][$productId])) {
        unset($_SESSION['cart'][$productId]);
    }
    header("Location: cart.php");
    exit();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shopping Cart</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>Shopping Cart</h1>
    </header>

    <main>
        <div class="cart-items">
            <?php
            include 'db.php';
            $total = 0;
            if (!empty($_SESSION['cart'])) {
                foreach ($_SESSION['cart'] as $id => $quantity) {
                    $sql = "SELECT * FROM products WHERE id=$id";
                    $result = $conn->query($sql);
                    $row = $result->fetch_assoc();
                    $total += $row['price'] * $quantity;
                    echo "<div class='cart-item'>";
                    echo "<h2>" . $row['name'] . "</h2>";
                    echo "<p>Quantity: " . $quantity . "</p>";
                    echo "<p>Price: $" . $row['price'] . "</p>";
                    echo "<a href='cart.php?remove=" . $row['id'] . "'>Remove</a>";
                    echo "</div>";
                }
            } else {
                echo "<p>Your cart is empty.</p>";
            }
            ?>

            <p>Total: $<?php echo number_format($total, 2); ?></p>
            <a href="checkout.php">Checkout</a>
        </div>
    </main>
</body>
</html>
